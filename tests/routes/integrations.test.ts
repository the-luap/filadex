/**
 * API tokens identify a print server to /api/integrations/* and the
 * Spoolman-compatible routes in place of a session cookie.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerIntegrationRoutes } from "../../server/routes/integrations";
import { registerSpoolmanCompatRoutes } from "../../server/routes/spoolman-compat";
import { createApp, registerAndVerify } from "../helpers/app";

let app: Express;
let token: string;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerIntegrationRoutes, registerSpoolmanCompatRoutes);
  const cookie = await registerAndVerify(app, alice);
  const created = await request(app).post("/api/api-tokens").set("Cookie", cookie).send({ label: "printer" });
  expect(created.status).toBe(201);
  token = created.body.token;
});

describe("an API token", () => {
  it("is accepted as a bearer token", async () => {
    await request(app).get("/api/spoolman-compat/v1/spool").set("Authorization", `Bearer ${token}`).expect(200);
  });

  it("is accepted in X-Api-Key", async () => {
    await request(app).get("/api/spoolman-compat/v1/spool").set("X-Api-Key", token).expect(200);
  });

  // A token in the URL lands in proxy access logs and print-server histories.
  it("is not accepted in the query string", async () => {
    const res = await request(app).get("/api/spoolman-compat/v1/spool").query({ token });

    expect(res.status).toBe(401);
  });

  it("does not open the session-only routes", async () => {
    await request(app).get("/api/api-tokens").set("Authorization", `Bearer ${token}`).expect(401);
  });
});
