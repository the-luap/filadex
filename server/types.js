// This file is used to extend Express Request type
// It's imported in routes.js to make TypeScript aware of the extensions

/**
 * @typedef {Object} User
 * @property {number} id - User ID
 * @property {string} username - Username
 * @property {boolean} isAdmin - Whether the user is an admin
 */

/**
 * Express Request with user properties
 * @typedef {Object} Request
 * @property {number} userId - User ID from authentication
 * @property {User} user - User object from authentication
 */

// No actual code is needed here, this is just for documentation
