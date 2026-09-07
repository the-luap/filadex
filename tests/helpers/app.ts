import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { lastMailTo, tokenFromMail } from "./mailbox";
import { initializeAdminUser } from "../../server/auth";
import { storage } from "../../server/storage";

/**
 * The seam these tests work at: a real express app with the real route
 * modules mounted, talking to a real Postgres. Only the middleware the routes
 * actually depend on is installed (JSON body parsing and cookies) - vite,
 * helmet and request logging play no part in the behaviour under test.
 */
export function createApp(...registerRoutes: Array<(app: Express) => void>): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  for (const register of registerRoutes) register(app);
  return app;
}

/** Logs in and returns the session cookie, failing loudly if login didn't work. */
export async function loginAs(app: Express, username: string, password: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ username, password });

  if (response.status !== 200) {
    throw new Error(`login as ${username} failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  // Seen once, in a full run under load: a 200 with no Set-Cookie at all,
  // which the route cannot produce. Rather than a TypeError on [0] that says
  // nothing, record what actually came back so the next occurrence can be
  // traced.
  const cookie = response.headers["set-cookie"]?.[0];
  if (!cookie) {
    throw new Error(
      `login as ${username} answered 200 without a session cookie; headers: ${JSON.stringify(response.headers)} body: ${JSON.stringify(response.body)}`,
    );
  }
  return cookie;
}

/**
 * Creates a usable account the way a real user does: register, then follow the
 * link from the verification email. Returns the session cookie.
 */
export async function registerAndVerify(
  app: Express,
  user: { username: string; email: string; password: string },
): Promise<string> {
  await request(app).post("/api/auth/register").send(user).expect(201);

  const token = tokenFromMail(lastMailTo(user.email));
  if (!token) throw new Error(`no verification token was emailed to ${user.email}`);

  await request(app).get("/api/auth/verify-email").query({ token }).expect(200);

  return loginAs(app, user.username, user.password);
}

/**
 * The default admin/admin account, ready to use. initializeAdminUser creates it
 * with forceChangePassword set, and the server refuses every route but
 * change-password to such an account - so a test that wants an admin to drive
 * the API has to clear the flag first, the way a real first login would.
 */
export async function bootstrapAdmin(): Promise<void> {
  await initializeAdminUser();
  const admin = await storage.getUserByUsername("admin");
  if (!admin) throw new Error("initializeAdminUser did not create the admin account");
  await storage.updateUser(admin.id, { forceChangePassword: false });
}
