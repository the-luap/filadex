import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./utils/logger";
import { storage } from "./storage";

// Secret key for JWT. Falling back to a fixed, publicly-known string would let anyone forge
// tokens for any unconfigured deployment, so an unset JWT_SECRET instead gets a random
// per-process secret (sessions won't survive a restart until JWT_SECRET is set explicitly).
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  logger.warn(
    "JWT_SECRET is not set - using a randomly generated secret for this process. " +
    "All active sessions will be invalidated on the next restart. Set JWT_SECRET in your environment to avoid this."
  );
  return crypto.randomBytes(32).toString("hex");
}

const JWT_SECRET = resolveJwtSecret();

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
      isAdmin: users.isAdmin,
      role: users.role
    }).from(users).where(eq(users.id, decoded.userId));

    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin === true,
        role: user.role
      };
    } else {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// API tokens (for printer/print-server integrations - see IMPLEMENTATION_PLAN.md #5)
// are high-entropy random strings, so they're hashed with a plain, fast digest
// rather than bcrypt: bcrypt has no way to look a row up by hash (it's salted
// per-call), which would mean comparing against every token in the table on
// every request. SHA-256 is fine here precisely because the input isn't a
// low-entropy user-chosen password.
const API_TOKEN_PREFIX = "fdx_";

export function generateApiToken(): { plaintext: string; hash: string } {
  const plaintext = API_TOKEN_PREFIX + crypto.randomBytes(24).toString("hex");
  return { plaintext, hash: hashApiToken(plaintext) };
}

export function hashApiToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Authenticates requests via an API token instead of the session cookie, for
// callers that can't hold a browser session (print servers). Accepts the
// token as `Authorization: Bearer <token>`, `X-Api-Key: <token>`, or
// `?token=<token>` - print-server HTTP clients vary in which they support.
export async function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined) ||
    (typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : undefined) ||
    (typeof req.query.token === "string" ? req.query.token : undefined);

  if (!token) {
    return res.status(401).json({ message: "API token required" });
  }

  const userId = await storage.getUserIdByTokenHash(hashApiToken(token));
  if (!userId) {
    return res.status(401).json({ message: "Invalid API token" });
  }

  req.userId = userId;
  next();
}

// RBAC middleware factory. Must run after `authenticate` (relies on req.user).
// Role is read fresh from the DB on every request via `authenticate`, so a
// demoted user's still-valid JWT can't retain stale elevated access.
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient privileges" });
    }

    next();
  };
}

// Kept as the admin-only gate used throughout the existing routes.
export const isAdmin = requireRole("admin");

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
        role: "admin",
        emailVerified: true,
        forceChangePassword: true
      });
      logger.info("Default admin user created");
    }
  } catch (error) {
    logger.error("Error initializing admin user:", error);
  }
}