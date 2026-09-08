import type { Express } from "express";
import crypto from "crypto";
import {
  type User,
  changePasswordSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  usernameSchema,
} from "../../shared/schema";
import { authenticate, hashPassword, verifyPassword, verifyPasswordOrBurnTime, generateToken, hashSecretToken, setSessionCookie } from "../auth";
import { storage } from "../storage";
import { sendMail } from "../utils/mailer";
import { verificationEmail, passwordResetEmail } from "../utils/email-templates";
import { getAppUrl } from "../utils/app-url";
import { publicAuthLimiter, loginLimiter } from "../utils/rate-limits";
import { resolveAnonymousLanguage } from "../utils/resolve-language";
import { isSupportedLanguage } from "@shared/languages";
import { logger as appLogger } from "../utils/logger";
import { ZodError } from "zod";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

function generateToken32(): string {
  return crypto.randomBytes(32).toString("hex");
}

// A link that leaves the browser is built from APP_URL, never from the request:
// the Host header is whatever the sender says it is, and a forged one turned
// forgot-password into a genuine email pointing at the attacker's host with the
// victim's live token. With APP_URL unset the mail is not sent at all, and the
// log says why, rather than guessing at an origin.
function emailedLink(path: string, token: string, purpose: string, to: string): string | null {
  const appUrl = getAppUrl();
  if (!appUrl) {
    appLogger.warn(`APP_URL is not set, so the ${purpose} email for ${to} was not sent. Set APP_URL to the address users reach this install at.`);
    return null;
  }
  return `${appUrl}${path}?token=${token}`;
}

// What the account's owner gets to see of their own row. The hash goes
// without saying; the pending reset and verification tokens matter too - with
// them, a stolen session could request a reset and read the token straight
// back, turning a seven-day cookie into a permanent takeover.
function sessionUser(user: User) {
  const {
    password: _password,
    passwordResetToken: _resetToken,
    passwordResetExpires: _resetExpires,
    emailVerificationToken: _verificationToken,
    emailVerificationExpires: _verificationExpires,
    usernameFolded: _folded,
    ...safe
  } = user;
  return safe;
}

export function registerAuthRoutes(app: Express): void {
  // Register a new account (public). Requires email verification before login.
  app.post("/api/auth/register", publicAuthLimiter, async (req, res) => {
    try {
      const systemSettings = await storage.getSystemSettings();
      if (!systemSettings.registrationEnabled) {
        return res.status(403).json({ message: "Registration is currently disabled" });
      }

      const { username, email, password } = registerSchema.parse(req.body);

      const existingByUsername = await storage.getUserByUsername(username);
      if (existingByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const created = { message: "Account created. Please check your email to verify your account." };

      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        if (existingByEmail.emailVerified) {
          // Same answer as for a new address, so the form cannot be used to
          // find out which emails have accounts. forgot-password and
          // resend-verification already behave this way.
          return res.status(201).json(created);
        }
        // An unverified row is a claim on the address, not an account: whoever
        // controls the mailbox gets to complete it. Letting it be replaced means
        // registering with someone else's email cannot squat on it.
        await storage.deleteUser(existingByEmail.id);
      }

      const hashedPassword = await hashPassword(password);
      const verificationToken = generateToken32();
      // Only the cookie and Accept-Language: /register is reachable with a
      // session already in the browser, and the new account's language must
      // not be inherited from whoever that `token` cookie belongs to.
      const lang = resolveAnonymousLanguage(req);

      await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: "user",
        isAdmin: false,
        emailVerified: false,
        emailVerificationToken: hashSecretToken(verificationToken),
        emailVerificationExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        forceChangePassword: false,
        language: lang,
      });

      const verifyUrl = emailedLink("/verify-email", verificationToken, "verification", email);
      if (verifyUrl) {
        await sendMail({ to: email, ...verificationEmail(lang, verifyUrl) });
      }

      res.status(201).json(created);
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

      const user = await storage.getUserByEmailVerificationToken(hashSecretToken(token));

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
          hashSecretToken(verificationToken),
          new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        );

        const verifyUrl = emailedLink("/verify-email", verificationToken, "verification", email);
        if (verifyUrl) {
          const lang = isSupportedLanguage(user.language) ? user.language : resolveAnonymousLanguage(req);
          await sendMail({ to: email, ...verificationEmail(lang, verifyUrl) });
        }
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
          hashSecretToken(resetToken),
          new Date(Date.now() + RESET_TOKEN_TTL_MS),
        );

        const resetUrl = emailedLink("/reset-password", resetToken, "password reset", email);
        if (resetUrl) {
          const lang = isSupportedLanguage(user.language) ? user.language : resolveAnonymousLanguage(req);
          await sendMail({ to: email, ...passwordResetEmail(lang, resetUrl) });
        }
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

      const user = await storage.getUserByPasswordResetToken(hashSecretToken(token));

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
      if (typeof username !== "string" || typeof password !== "string") {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Matched case-insensitively, the same way registration and admin user
      // creation check for a duplicate: if "ALICE" cannot be registered while
      // "alice" exists, then "ALICE" has to be a way to log in as "alice".
      const user = await storage.getUserByUsername(username);

      // The compare runs whether or not the account exists, so the two
      // failures take the same time.
      if (!(await verifyPasswordOrBurnTime(password, user?.password)) || !user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ message: "Please verify your email address before logging in" });
      }

      // Update last login
      await storage.recordLogin(user.id);

      setSessionCookie(res, generateToken(user.id));

      res.json({
        user: sessionUser(user),
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

      res.json(sessionUser(user));
    } catch (error) {
      appLogger.error("Get user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", authenticate, loginLimiter, async (req, res) => {
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

      // The change invalidates every session issued before it - including, a
      // second or more after logging in, the one making this request. Hand
      // that session a fresh cookie so the user carries on; the others stay
      // locked out, which is the point.
      setSessionCookie(res, generateToken(req.userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      appLogger.error("Change password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}
