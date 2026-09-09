import rateLimit from "express-rate-limit";

// Per-IP limiters, shared by the routes that need them. All key on req.ip,
// which is the proxy's address unless TRUST_PROXY is set - see server/index.ts.

const skipIfDisabled = () => process.env.DISABLE_RATE_LIMITS === "true";

// Public, enumeration-sensitive endpoints: register, forgot-password,
// resend-verification, check-username.
export const publicAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  message: { message: "Too many requests, please try again later" },
});

// Anything that verifies a password: login, and change-password, which with a
// stolen session would otherwise be an unthrottled oracle for the current one.
//
// Only failed attempts count. That is what the limiter is for - an attacker
// guessing passwords produces 401s, and those still consume the budget - while
// someone who knows their password never spends anyone else's, which matters
// on a shared address behind NAT or a reverse proxy. It also keeps the browser
// suite honest: it signs in about fifteen times per run, and counting those
// successes put it one flaky retry away from locking itself out.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts, please try again later" },
});

// The anonymous share page. Generous, since one shared link may be opened by
// many people behind one address, but bounded, since the user id in the path
// is a small integer and the endpoint otherwise enumerates accounts for free.
export const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  message: { message: "Too many requests, please try again later" },
});

// Authenticated actions that mint credentials or do expensive work per call:
// API token creation, backups, cache refresh, test mail.
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfDisabled,
  message: { message: "Too many requests, please try again later" },
});
