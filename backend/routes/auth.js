/**
 * Authentication Routes
 * Handles user registration, login, logout, and token refresh
 */

import prisma from '../prisma/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  isValidEmail,
  validatePassword
} from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Register auth routes with Fastify app
 * @param {FastifyInstance} app - Fastify app instance
 */
export function registerAuthRoutes(app) {

  /**
   * POST /auth/register
   * Create a new user account
   *
   * Body: { name, email, password }
   * Returns: { user, accessToken, refreshToken }
   */
  app.post('/auth/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).send({
          error: 'Name is required and must be a non-empty string'
        });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).send({
          error: 'Valid email address is required'
        });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).send({
          error: passwordValidation.message
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });

      if (existingUser) {
        return res.status(409).send({
          error: 'An account with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate tokens
      const tempUserId = Date.now(); // Temporary ID for token generation
      const refreshToken = generateRefreshToken({ userId: tempUserId });

      // Create user
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          refreshToken: refreshToken
        }
      });

      // Generate proper tokens with real user ID
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name
      });

      const newRefreshToken = generateRefreshToken({ userId: user.id });

      // Update user with real refresh token
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken }
      });

      req.log.info({ userId: user.id, email: user.email }, 'User registered successfully');

      return res.status(201).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken: newRefreshToken
      });

    } catch (error) {
      req.log.error({ err: error }, 'Registration error');
      return res.status(500).send({
        error: 'An error occurred during registration'
      });
    }
  });

  /**
   * POST /auth/login
   * Login with email and password
   *
   * Body: { email, password }
   * Returns: { user, accessToken, refreshToken }
   */
  app.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).send({
          error: 'Email and password are required'
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });

      if (!user) {
        return res.status(401).send({
          error: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).send({
          error: 'Invalid email or password'
        });
      }

      // Generate new tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name
      });

      const refreshToken = generateRefreshToken({ userId: user.id });

      // Update refresh token in database
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
      });

      req.log.info({ userId: user.id, email: user.email }, 'User logged in successfully');

      return res.status(200).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      req.log.error({ err: error }, 'Login error');
      return res.status(500).send({
        error: 'An error occurred during login'
      });
    }
  });

  /**
   * POST /auth/refresh
   * Get a new access token using refresh token
   *
   * Body: { refreshToken }
   * Returns: { accessToken }
   */
  app.post('/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).send({
          error: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      if (!decoded || !decoded.userId) {
        return res.status(401).send({
          error: 'Invalid or expired refresh token'
        });
      }

      // Check if refresh token matches database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).send({
          error: 'Invalid refresh token'
        });
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        name: user.name
      });

      req.log.info({ userId: user.id }, 'Access token refreshed');

      return res.status(200).send({
        accessToken
      });

    } catch (error) {
      req.log.error({ err: error }, 'Token refresh error');
      return res.status(500).send({
        error: 'An error occurred during token refresh'
      });
    }
  });

  /**
   * POST /auth/logout
   * Logout user by invalidating refresh token
   * Requires authentication
   *
   * Returns: { message }
   */
  app.post('/auth/logout', { preHandler: requireAuth }, async (req, res) => {
    try {
      // Get user from request (added by auth middleware)
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).send({
          error: 'Not authenticated'
        });
      }

      // Clear refresh token from database
      await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null }
      });

      req.log.info({ userId }, 'User logged out');

      return res.status(200).send({
        message: 'Logged out successfully'
      });

    } catch (error) {
      req.log.error({ err: error }, 'Logout error');
      return res.status(500).send({
        error: 'An error occurred during logout'
      });
    }
  });

  /**
   * GET /auth/me
   * Get current authenticated user info
   * Requires authentication
   *
   * Returns: { user }
   */
  app.get('/auth/me', { preHandler: requireAuth }, async (req, res) => {
    try {
      // Get user from request (added by auth middleware)
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).send({
          error: 'Not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).send({
          error: 'User not found'
        });
      }

      return res.status(200).send({ user });

    } catch (error) {
      req.log.error({ err: error }, 'Get user error');
      return res.status(500).send({
        error: 'An error occurred fetching user data'
      });
    }
  });
}
