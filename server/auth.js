import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../dist/index.js';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'filadex-secret-key';

// Hash a password
export async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify a password against a hash
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Generate a JWT token
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify a JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export async function authenticate(req, res, next) {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Set user ID on request
    req.userId = decoded.userId;
    
    // Get user from database
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, decoded.userId));
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Set user on request
    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Admin check middleware
export function isAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
}

// Initialize admin user
export async function initializeAdminUser() {
  try {
    // Check if admin user exists
    const existingUsers = await db.select().from(schema.users);
    
    if (existingUsers.length === 0) {
      console.log('No users found in database. Creating default admin user...');
      
      // Create admin user
      const hashedPassword = await hashPassword('admin');
      
      await db.insert(schema.users).values({
        username: 'admin',
        password: hashedPassword,
        isAdmin: true,
        forceChangePassword: true
      });
      
      // Create regular user
      await db.insert(schema.users).values({
        username: 'user',
        password: await hashPassword('password'),
        isAdmin: false,
        forceChangePassword: false
      });
      
      console.log('Default users created successfully');
    } else {
      console.log(`Found ${existingUsers.length} existing users in database`);
    }
  } catch (error) {
    console.error('Error initializing users:', error);
  }
}
