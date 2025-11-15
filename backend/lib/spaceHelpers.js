/**
 * Space Helper Functions
 * Utilities for checking space membership and permissions
 */

import prisma from '../prisma/prisma.js';

/**
 * Check if a user is a member of a space
 * @param {number} userId - User ID
 * @param {number} spaceId - Space ID
 * @returns {Promise<boolean>} - True if user is a member
 */
export async function isSpaceMember(userId, spaceId) {
  const membership = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId: spaceId,
        userId: userId
      }
    }
  });
  return !!membership;
}

/**
 * Check if a user owns a space
 * @param {number} userId - User ID
 * @param {number} spaceId - Space ID
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
 * Get user's role in a space
 * @param {number} userId - User ID
 * @param {number} spaceId - Space ID
 * @returns {Promise<string|null>} - Role (OWNER, ADMIN, MEMBER) or null if not a member
 */
export async function getUserSpaceRole(userId, spaceId) {
  const membership = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId: spaceId,
        userId: userId
      }
    },
    select: { role: true }
  });
  return membership?.role || null;
}

/**
 * Add a user to a space as a member
 * @param {number} userId - User ID
 * @param {number} spaceId - Space ID
 * @param {string} role - Role (OWNER, ADMIN, MEMBER) - defaults to MEMBER
 * @returns {Promise<object>} - SpaceMember record
 */
export async function addSpaceMember(userId, spaceId, role = 'MEMBER') {
  return prisma.spaceMember.create({
    data: {
      userId,
      spaceId,
      role
    }
  });
}

/**
 * Resolve the user key from old header-based system
 * DEPRECATED - Use req.user.userId from JWT instead
 * This is kept temporarily for backward compatibility
 */
export function resolveUserKey(req) {
  // Try to get from JWT first
  if (req.user?.userId) {
    return `user-${req.user.userId}`;
  }

  // Fall back to old header-based system (INSECURE - will be removed)
  const rawHeader = req.headers?.["x-user-id"] ??
                    req.headers?.["x-user"] ??
                    req.headers?.["x-user-key"] ?? null;
  return rawHeader ? rawHeader.trim().slice(0, 120) : "anonymous-tester";
}
