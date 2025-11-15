/**
 * Authentication Utilities
 * Handles JWT token generation/verification and password hashing
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// JWT Configuration
// In production, these should come from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '15m'; // Access tokens expire in 15 minutes
const JWT_REFRESH_EXPIRES_IN = '7d'; // Refresh tokens expire in 7 days

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10); // 10 rounds is a good balance of security/performance
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} - True if password matches
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 * This is a short-lived token used for API requests
 * @param {object} payload - User data to encode in token (e.g., { userId, email })
 * @returns {string} - Signed JWT token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'giftlink-api',
    audience: 'giftlink-client'
  });
}

/**
 * Generate JWT refresh token
 * This is a long-lived token used to get new access tokens
 * @param {object} payload - User data to encode in token (e.g., { userId })
 * @returns {string} - Signed JWT refresh token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'giftlink-api',
    audience: 'giftlink-client'
  });
}

/**
 * Verify and decode JWT access token
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded payload if valid, null if invalid
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'giftlink-api',
      audience: 'giftlink-client'
    });
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Verify and decode JWT refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {object|null} - Decoded payload if valid, null if invalid
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'giftlink-api',
      audience: 'giftlink-client'
    });
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Supports "Bearer <token>" format
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token if found, null otherwise
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: At least 8 characters
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, message: string }
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long'
    };
  }

  // You can add more requirements here:
  // - Must contain uppercase letter
  // - Must contain lowercase letter
  // - Must contain number
  // - Must contain special character

  return {
    valid: true,
    message: 'Password is valid'
  };
}
