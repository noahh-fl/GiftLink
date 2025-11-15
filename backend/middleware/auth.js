/**
 * Authentication Middleware
 * Protects routes by verifying JWT tokens
 */

import { verifyAccessToken, extractTokenFromHeader } from '../lib/auth.js';
import prisma from '../prisma/prisma.js';

/**
 * Fastify middleware to require authentication
 * Verifies JWT access token and attaches user info to request
 *
 * Usage:
 *   app.get('/protected-route', { preHandler: requireAuth }, async (req, res) => {
 *     const userId = req.user.userId; // User is authenticated
 *   });
 *
 * @param {FastifyRequest} req
 * @param {FastifyReply} res
 */
export async function requireAuth(req, res) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).send({
        error: 'No authentication token provided',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded || !decoded.userId) {
      return res.status(401).send({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name
    };

    // Continue to route handler
  } catch (error) {
    req.log.error({ err: error }, 'Authentication error');
    return res.status(500).send({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Fastify middleware to optionally attach user if authenticated
 * Does NOT block unauthenticated requests
 *
 * Usage:
 *   app.get('/optional-auth-route', { preHandler: optionalAuth }, async (req, res) => {
 *     if (req.user) {
 *       // User is authenticated
 *     } else {
 *       // User is not authenticated, but that's ok
 *     }
 *   });
 */
export async function optionalAuth(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, that's ok
      return;
    }

    const decoded = verifyAccessToken(token);

    if (decoded && decoded.userId) {
      // Token is valid, attach user
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    }

    // Continue regardless of token validity
  } catch (error) {
    // Ignore errors for optional auth
    req.log.warn({ err: error }, 'Optional auth failed');
  }
}

/**
 * Check if authenticated user is a member of a space
 * Requires requireAuth middleware to be run first
 *
 * @param {number} userId - User ID from req.user
 * @param {number} spaceId - Space ID to check
 * @returns {Promise<object|null>} - SpaceMember record if user is member, null otherwise
 */
export async function checkSpaceMembership(userId, spaceId) {
  return prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId: spaceId,
        userId: userId
      }
    },
    include: {
      space: {
        select: {
          id: true,
          name: true,
          ownerId: true
        }
      }
    }
  });
}

/**
 * Check if authenticated user is the owner of a space
 *
 * @param {number} userId - User ID from req.user
 * @param {number} spaceId - Space ID to check
 * @returns {Promise<boolean>} - True if user owns the space
 */
export async function isSpaceOwner(userId, spaceId) {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { ownerId: true }
  });

  return space?.ownerId === userId;
}

/**
 * Middleware to require space membership
 * Use after requireAuth middleware
 *
 * Usage:
 *   app.get('/spaces/:id/data', {
 *     preHandler: [requireAuth, requireSpaceMembership]
 *   }, async (req, res) => {
 *     // User is authenticated AND a member of the space
 *   });
 */
export async function requireSpaceMembership(req, res) {
  try {
    const userId = req.user?.userId;
    const spaceId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).send({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!spaceId || isNaN(spaceId)) {
      return res.status(400).send({
        error: 'Invalid space ID',
        code: 'INVALID_SPACE_ID'
      });
    }

    const membership = await checkSpaceMembership(userId, spaceId);

    if (!membership) {
      return res.status(403).send({
        error: 'You are not a member of this space',
        code: 'NOT_SPACE_MEMBER'
      });
    }

    // Attach membership info to request
    req.spaceMember = membership;

    // Continue to route handler
  } catch (error) {
    req.log.error({ err: error }, 'Space membership check error');
    return res.status(500).send({
      error: 'Failed to verify space membership',
      code: 'MEMBERSHIP_CHECK_ERROR'
    });
  }
}

/**
 * Middleware to require space ownership
 * Use after requireAuth middleware
 *
 * Usage:
 *   app.delete('/spaces/:id', {
 *     preHandler: [requireAuth, requireSpaceOwnership]
 *   }, async (req, res) => {
 *     // User is authenticated AND owns the space
 *   });
 */
export async function requireSpaceOwnership(req, res) {
  try {
    const userId = req.user?.userId;
    const spaceId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).send({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!spaceId || isNaN(spaceId)) {
      return res.status(400).send({
        error: 'Invalid space ID',
        code: 'INVALID_SPACE_ID'
      });
    }

    const isOwner = await isSpaceOwner(userId, spaceId);

    if (!isOwner) {
      return res.status(403).send({
        error: 'Only the space owner can perform this action',
        code: 'NOT_SPACE_OWNER'
      });
    }

    // Continue to route handler
  } catch (error) {
    req.log.error({ err: error }, 'Space ownership check error');
    return res.status(500).send({
      error: 'Failed to verify space ownership',
      code: 'OWNERSHIP_CHECK_ERROR'
    });
  }
}
