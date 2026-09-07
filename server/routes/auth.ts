import type { Express, Request } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import {
  changePasswordSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  usernameSchema,
} from "../../shared/schema";
import { authenticate, hashPassword, verifyPassword, generateToken } from "../auth";
import { storage } from "../storage";
import { sendMail } from "../utils/mailer";
import { verificationEmail, passwordResetEmail } from "../utils/email-templates";
import { resolveLanguage } from "../utils/resolve-language";
import { isSupportedLanguage } from "@shared/languages";
import { logger as appLogger } from "../utils/logger";
import { ZodError } from "zod";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

// Generic limiter for the public, enumeration-sensitive endpoints (register,
// forgot-password, resend-verification, check-username).
const publicAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

// Slightly tighter limiter for login specifically, to slow down brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

function generateToken32(): string {
  return crypto.randomBytes(32).toString("hex");
}

function baseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

export function registerAuthRoutes(app: Express): void {
  // Register a new account (public). Requires email verification before login.
  app.post("/api/auth/register", publicAuthLimiter, async (req, res) => {
    try {
      const { username, email, password } = registerSchema.parse(req.body);

      const existingByUsername = await storage.getUserByUsername(username);
      if (existingByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const verificationToken = generateToken32();
      const lang = await resolveLanguage(req);

      await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: "user",
        isAdmin: false,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        forceChangePassword: false,
        language: lang,
      });

      const verifyUrl = `${baseUrl(req)}/verify-email?token=${verificationToken}`;
      await sendMail({ to: email, ...verificationEmail(lang, verifyUrl) });

      res.status(201).json({ message: "Account created. Please check your email to verify your account." });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      appLogger.error("Register error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Real-time username availability check for the registration form (public).
  app.get("/api/auth/check-username", publicAuthLimiter, async (req, res) => {
    try {
      const parsed = usernameSchema.safeParse(req.query.username);
      if (!parsed.success) {
        return res.json({ available: false, reason: parsed.error.errors[0]?.message });
      }

      const existing = await storage.getUserByUsername(parsed.data);
      res.json({ available: !existing });
    } catch (error) {
      appLogger.error("Check username error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Verify email via the emailed link (public).
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Invalid verification link" });
      }

      const user = await storage.getUserByEmailVerificationToken(token);

      if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
        return res.status(400).json({ message: "This verification link is invalid or has expired" });
      }

      await storage.markEmailVerified(user.id);

      res.json({ message: "Email verified successfully. You can now log in." });
    } catch (error) {
      appLogger.error("Verify email error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Resend the verification email (public). Same response whether or not the account exists.
  app.post("/api/auth/resend-verification", publicAuthLimiter, async (req, res) => {
    const genericResponse = { message: "If an account with that email exists and isn't verified yet, a new verification email has been sent." };
    try {
      const { email } = resendVerificationSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);

      if (user && !user.emailVerified) {
        const verificationToken = generateToken32();
        await storage.setEmailVerificationToken(
          user.id,
          verificationToken,
          new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        );

        const verifyUrl = `${baseUrl(req)}/verify-email?token=${verificationToken}`;
        const lang = isSupportedLanguage(user.language) ? user.language : await resolveLanguage(req);
        await sendMail({ to: email, ...verificationEmail(lang, verifyUrl) });
      }

      res.json(genericResponse);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      appLogger.error("Resend verification error:", error);
      res.json(genericResponse);
    }
  });

  // Request a password reset email (public). Same response whether or not the account exists,
  // to avoid leaking which emails have accounts.
  app.post("/api/auth/forgot-password", publicAuthLimiter, async (req, res) => {
    const genericResponse = { message: "If an account with that email exists, a password reset link has been sent." };
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);

      if (user) {
        const resetToken = generateToken32();
        await storage.setPasswordResetToken(
          user.id,
          resetToken,
          new Date(Date.now() + RESET_TOKEN_TTL_MS),
        );

        const resetUrl = `${baseUrl(req)}/reset-password?token=${resetToken}`;
        const lang = isSupportedLanguage(user.language) ? user.language : await resolveLanguage(req);
        await sendMail({ to: email, ...passwordResetEmail(lang, resetUrl) });
      }

      res.json(genericResponse);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      appLogger.error("Forgot password error:", error);
      res.json(genericResponse);
    }
  });

  // Complete a password reset using the emailed token (public).
  app.post("/api/auth/reset-password", publicAuthLimiter, async (req, res) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);

      const user = await storage.getUserByPasswordResetToken(token);

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "This reset link is invalid or has expired" });
      }

      await storage.resetPassword(user.id, await hashPassword(newPassword));

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      appLogger.error("Reset password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Login
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;

      // Matched case-insensitively, the same way registration and admin user
      // creation check for a duplicate: if "ALICE" cannot be registered while
      // "alice" exists, then "ALICE" has to be a way to log in as "alice".
      const user = await storage.getUserByUsername(username);

      if (!user || !(await verifyPassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ message: "Please verify your email address before logging in" });
      }

      // Update last login
      await storage.recordLogin(user.id);

      // Generate token
      const token = generateToken(user.id);

      // Set cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return user info (without password)
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        forceChangePassword: user.forceChangePassword
      });
    } catch (error) {
      appLogger.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  });

  // Get current user
  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      appLogger.error("Get user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", authenticate, async (req, res) => {
    try {
      const result = changePasswordSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.format() });
      }

      const { currentPassword, newPassword } = result.data;

      const user = await storage.getUser(req.userId);

      if (!user || !(await verifyPassword(currentPassword, user.password))) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      await storage.changePassword(req.userId, await hashPassword(newPassword));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      appLogger.error("Change password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}
