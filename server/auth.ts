import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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

// bcrypt work for a login attempt against a username that does not exist, so
// that "no such user" takes as long as "wrong password" and the two cannot be
// told apart by timing.
const NO_SUCH_USER_HASH = bcrypt.hashSync("no-such-user", 10);

export async function verifyPasswordOrBurnTime(plainPassword: string, hashedPassword: string | undefined): Promise<boolean> {
  if (hashedPassword === undefined) {
    await bcrypt.compare(plainPassword, NO_SUCH_USER_HASH);
    return false;
  }
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// Reset and verification tokens are stored hashed, so a read of the users
// table - a backup, a log, a stray query - does not hand out live tokens. Like
// API tokens they are 256-bit random values, so a fast digest is the right
// hash: there is nothing for bcrypt's cost to protect against.
export function hashSecretToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Generate JWT token
export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// The session cookie, set the same way wherever a session is issued.
export function setSessionCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// Verify a JWT from the token cookie without requiring a full request context.
// Returns the userId on success, or null if the token is missing/invalid/expired.
export function verifyToken(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    return decoded?.userId ?? null;
  } catch {
    return null;
  }
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

// The only routes an account that must still change its password may use.
// Everything else answers 403 with a code the client turns into a redirect.
// Without this the flag was a client-side suggestion: a session for
// admin/admin could drive every route while the password was still admin.
const ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = new Set([
  "POST /api/auth/change-password",
  "GET /api/auth/me",
  "POST /api/auth/logout",
  "POST /api/users/language",
  "GET /api/theme",
]);

function allowedWhilePasswordChangePending(req: Request): boolean {
  return ALLOWED_WHILE_PASSWORD_CHANGE_PENDING.has(`${req.method} ${req.path}`);
}

// Authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  let decoded: { userId: number; iat?: number };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { userId: number; iat?: number };
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (!decoded || !decoded.userId) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    // Get user data and attach to request
    const user = await storage.getUserAuthContext(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // A token issued before the password was last set is refused. `iat` is in
    // whole seconds, so a token issued in the same second as the change - the
    // login that follows it - is still accepted.
    if (user.passwordChangedAt && decoded.iat !== undefined
        && Math.floor(user.passwordChangedAt.getTime() / 1000) > decoded.iat) {
      return res.status(401).json({ message: "Session expired because the password was changed" });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin === true,
      role: user.role
    };

    if (user.forceChangePassword && !allowedWhilePasswordChangePending(req)) {
      return res.status(403).json({
        message: "You must change your password before continuing",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(500).json({ message: "Server error" });
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
// token as `Authorization: Bearer <token>` or `X-Api-Key: <token>`. It used to
// take `?token=` as well; a token in the URL ends up in proxy access logs and
// print-server histories, where a header does not.
export async function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined) ||
    (typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : undefined);

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

// Creates the default admin/admin account when the install has no admin at
// all. The check is for the role, not the name: it used to look for an account
// called "admin", so renaming the bootstrap account brought a fresh admin/admin
// back on the next restart.
export async function initializeAdminUser() {
  try {
    if (await storage.countAdmins() > 0) {
      return;
    }

    if (await storage.getUserByUsername("admin")) {
      logger.error(
        "No account has the admin role, but the username 'admin' is taken, so the default admin cannot be created. " +
        "Promote an account to admin directly in the database."
      );
      return;
    }

    {
      // Create default admin user
      const hashedPassword = await hashPassword("admin");
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        isAdmin: true,
        role: "admin",
        emailVerified: true,
        forceChangePassword: true
      });
      logger.warn("Default admin user created with the well-known password 'admin'. Log in and change it now; every other route is refused until you do.");
    }
  } catch (error) {
    logger.error("Error initializing admin user:", error);
  }
}