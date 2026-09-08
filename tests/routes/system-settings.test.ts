import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerSystemSettingsRoutes } from "../../server/routes/system-settings";
import { createApp, loginAs, registerAndVerify, bootstrapAdmin } from "../helpers/app";

let app: Express;
let adminCookie: string;
let userCookie: string;

// the password below is safe to keep in the repository (hence the ggignore tag).
const testUser = {
  username: "alice",
  email: "alice@example.com",
  password: "correct-horse-battery-staple", // ggignore
};

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerSystemSettingsRoutes);
  await bootstrapAdmin();
  adminCookie = await loginAs(app, "admin", "admin");
  userCookie = await registerAndVerify(app, testUser);
});

describe("System Settings & Registration Policy", () => {
  describe("GET /api/system/public-settings", () => {
    it("returns public system settings without requiring authentication", async () => {
      const response = await request(app).get("/api/system/public-settings");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("registrationEnabled");
      expect(typeof response.body.registrationEnabled).toBe("boolean");
    });
  });

  describe("GET /api/settings/system", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await request(app).get("/api/settings/system");
      expect(response.status).toBe(401);
    });

    it("rejects non-admin users with 403", async () => {
      const response = await request(app)
        .get("/api/settings/system")
        .set("Cookie", [userCookie]);
      expect(response.status).toBe(403);
    });

    it("returns system settings for admin", async () => {
      const response = await request(app)
        .get("/api/settings/system")
        .set("Cookie", [adminCookie]);
      expect(response.status).toBe(200);
      expect(response.body.registrationEnabled).toBe(true);
    });
  });

  describe("PUT /api/settings/system", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await request(app)
        .put("/api/settings/system")
        .send({ registrationEnabled: false });
      expect(response.status).toBe(401);
    });

    it("rejects non-admin requests with 403", async () => {
      const response = await request(app)
        .put("/api/settings/system")
        .set("Cookie", [userCookie])
        .send({ registrationEnabled: false });
      expect(response.status).toBe(403);
    });

    it("allows admin to toggle registrationEnabled and updates public settings", async () => {
      const putResponse = await request(app)
        .put("/api/settings/system")
        .set("Cookie", [adminCookie])
        .send({ registrationEnabled: false });

      expect(putResponse.status).toBe(200);
      expect(putResponse.body.registrationEnabled).toBe(false);

      const publicResponse = await request(app).get("/api/system/public-settings");
      expect(publicResponse.status).toBe(200);
      expect(publicResponse.body.registrationEnabled).toBe(false);
    });
  });

  describe("POST /api/auth/register when registration is disabled", () => {
    it("rejects registration with 403 Forbidden when registrationEnabled is false", async () => {
      // Disable registration via admin
      await request(app)
        .put("/api/settings/system")
        .set("Cookie", [adminCookie])
        .send({ registrationEnabled: false })
        .expect(200);

      // Attempt self-registration
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "bob",
          email: "bob@example.com",
          password: "another-secure-password", // ggignore
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/registration is currently disabled/i);
    });
  });

  describe("DISABLE_REGISTRATION environment variable initialization", () => {
    it("defaults registrationEnabled to false when DISABLE_REGISTRATION=true on first creation", async () => {
      const { db } = await import("../helpers/db");
      const { systemSettings } = await import("../../shared/schema");
      const { storage } = await import("../../server/storage");
      await db.delete(systemSettings);

      const oldEnv = process.env.DISABLE_REGISTRATION;
      try {
        process.env.DISABLE_REGISTRATION = "true";
        const settings = await storage.getSystemSettings();
        expect(settings.registrationEnabled).toBe(false);
      } finally {
        if (oldEnv === undefined) {
          delete process.env.DISABLE_REGISTRATION;
        } else {
          process.env.DISABLE_REGISTRATION = oldEnv;
        }
      }
    });
  });
});
