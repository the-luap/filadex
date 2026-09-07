/**
 * Characterisation tests for server/routes/email-settings.ts - the admin-only
 * SMTP configuration.
 *
 * These record observable behaviour at the HTTP boundary, so that moving the
 * database access behind IStorage can be shown to change nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerEmailSettingsRoutes } from "../../server/routes/email-settings";
import { db } from "../helpers/db";
import { emailSettings } from "../../shared/schema";
import { createApp, loginAs, registerAndVerify, bootstrapAdmin } from "../helpers/app";

// This route reads the settings through the mailer, which tests/setup.ts
// replaces wholesale. Keep the real getEmailSettings - it is part of what is
// under test here - and collect outgoing mail as the rest of the suite does.
vi.mock("../../server/utils/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server/utils/mailer")>();
  const { mailbox } = await import("../helpers/mailbox");
  return {
    getEmailSettings: actual.getEmailSettings,
    sendMail: async (mail: { to: string; subject: string; html: string }) => {
      mailbox.push(mail);
      return true;
    },
  };
});

let app: Express;
let adminCookie: string;
let userCookie: string;

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerEmailSettingsRoutes);
  await bootstrapAdmin();
  adminCookie = await loginAs(app, "admin", "admin");
  userCookie = await registerAndVerify(app, {
    username: "alice",
    email: "alice@example.com",
    // Mock credentials for a throwaway test database - not a real login anywhere, so
    // the password below is safe to keep in the repository (hence the ggignore tag).
    password: "correct-horse", // ggignore
  });
});

async function storeSettings(overrides: Partial<typeof emailSettings.$inferInsert> = {}) {
  await db.insert(emailSettings).values({
    id: 1,
    enabled: true,
    smtpHost: "smtp.example.com",
    smtpPort: 2525,
    smtpUser: "postmaster",
    smtpPassword: "hunter2",
    fromEmail: "filadex@example.com",
    fromName: "Filadex",
    ...overrides,
  });
}

describe("GET /api/settings/email", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).get("/api/settings/email").set("Cookie", userCookie);

    expect(response.status).toBe(403);
  });

  it("reports nothing configured on a fresh installation", async () => {
    const response = await request(app).get("/api/settings/email").set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Email settings not found");
  });

  // The stored password never leaves the server; the client is told only
  // whether one is set, so the form can show a placeholder.
  it("returns the settings without the password, saying only whether one is set", async () => {
    await storeSettings();

    const response = await request(app).get("/api/settings/email").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("smtpPassword");
    expect(response.body).toMatchObject({
      enabled: true,
      smtpHost: "smtp.example.com",
      smtpPort: 2525,
      hasPassword: true,
    });
  });

  it("reports no password when none is stored", async () => {
    await storeSettings({ smtpPassword: null });

    const response = await request(app).get("/api/settings/email").set("Cookie", adminCookie);

    expect(response.body.hasPassword).toBe(false);
  });
});

describe("PUT /api/settings/email", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", userCookie)
      .send({ enabled: true });

    expect(response.status).toBe(403);
  });

  it("stores the settings and answers without the password", async () => {
    await storeSettings({ enabled: false, smtpHost: null });

    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", adminCookie)
      .send({ enabled: true, smtpHost: "smtp.new.example", fromEmail: "hello@example.com" });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("smtpPassword");
    expect(response.body).toMatchObject({
      enabled: true,
      smtpHost: "smtp.new.example",
      fromEmail: "hello@example.com",
    });

    const readBack = await request(app).get("/api/settings/email").set("Cookie", adminCookie);
    expect(readBack.body.smtpHost).toBe("smtp.new.example");
  });

  it("keeps the existing password when the request omits one", async () => {
    await storeSettings();

    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", adminCookie)
      .send({ smtpHost: "smtp.new.example" });

    expect(response.body.hasPassword).toBe(true);
  });

  it("records when the settings were last changed", async () => {
    await storeSettings({ updatedAt: new Date("2020-01-01T00:00:00Z") });

    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", adminCookie)
      .send({ enabled: false });

    expect(new Date(response.body.updatedAt).getFullYear()).toBeGreaterThan(2020);
  });

  it("rejects a value of the wrong type", async () => {
    await storeSettings();

    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", adminCookie)
      .send({ smtpPort: "not-a-number" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/^Validation error/);
  });

  // There is no route that creates the settings row - a migration seeds it - so
  // updating before it exists updates nothing and falls over on the way out.
  it("answers 500 when no settings row exists yet", async () => {
    const response = await request(app)
      .put("/api/settings/email")
      .set("Cookie", adminCookie)
      .send({ enabled: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Failed to update email settings");
  });
});

describe("POST /api/settings/email/test", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app)
      .post("/api/settings/email/test")
      .set("Cookie", userCookie)
      .send({ to: "someone@example.com" });

    expect(response.status).toBe(403);
  });

  it.each([
    ["a recipient that is not an address", { to: "not-an-address" }],
    ["a recipient that is not a string", { to: 42 }],
  ])("rejects %s", async (_label, body) => {
    const response = await request(app)
      .post("/api/settings/email/test")
      .set("Cookie", adminCookie)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("A valid recipient email address is required");
  });

  // The admin account created by the bootstrap has no email address, and the
  // fallback recipient is the username - which is "admin", not an address.
  it("rejects a request with no recipient when the caller's username is not an address", async () => {
    const response = await request(app).post("/api/settings/email/test").set("Cookie", adminCookie).send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("A valid recipient email address is required");
  });

  it("reports the send", async () => {
    await storeSettings();

    const response = await request(app)
      .post("/api/settings/email/test")
      .set("Cookie", adminCookie)
      .send({ to: "someone@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Test email sent");
  });
});
