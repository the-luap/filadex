import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "filadex-secret-key";

// Generate JWT token
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// Verify password
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.userId = decoded.userId;

    // Get user data and attach to request
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin
    }).from(users).where(eq(users.id, decoded.userId));

    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin === true
      };
    } else {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Admin middleware
export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId));

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
}

// Initialize admin user
export async function initializeAdminUser() {
  try {
    // Check if admin user exists
    const adminExists = await db.select().from(users).where(eq(users.username, "admin"));

    if (adminExists.length === 0) {
      // Create default admin user
      const hashedPassword = await hashPassword("admin");
      await db.insert(users).values({
        username: "admin",
        password: hashedPassword,
        isAdmin: true,
        forceChangePassword: true
      });
      console.log("Default admin user created");
    }
  } catch (error) {
    console.error("Error initializing admin user:", error);
  }
}