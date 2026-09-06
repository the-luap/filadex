/**
 * Characterisation tests for server/routes/catalog-requests.ts - users asking
 * for a catalog entry, admins approving or rejecting it.
 *
 * These record observable behaviour at the HTTP boundary, so that moving the
 * database access behind IStorage can be shown to change nothing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerCatalogRequestRoutes } from "../../server/routes/catalog-requests";
import { initializeAdminUser } from "../../server/auth";
import { storage } from "../../server/storage";
import { catalogRequests } from "../../shared/schema";
import { db } from "../helpers/db";
import { createApp, loginAs, registerAndVerify } from "../helpers/app";
import { lastMailTo, mailbox } from "../helpers/mailbox";

let app: Express;
let adminCookie: string;
let aliceCookie: string;
let aliceId: number;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerCatalogRequestRoutes);
  await initializeAdminUser();
  adminCookie = await loginAs(app, "admin", "admin");
  aliceCookie = await registerAndVerify(app, alice);
  aliceId = (await request(app).get("/api/auth/me").set("Cookie", aliceCookie)).body.id;
});

/** Submits a request as Alice and returns the created row. */
async function submit(entityType: string, payload: Record<string, unknown>) {
  const response = await request(app)
    .post("/api/catalog-requests")
    .set("Cookie", aliceCookie)
    .send({ entityType, payload });
  expect(response.status).toBe(201);
  return response.body as { id: number; status: string };
}

describe("POST /api/catalog-requests", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app)
      .post("/api/catalog-requests")
      .send({ entityType: "material", payload: { name: "PCTG" } });

    expect(response.status).toBe(401);
  });

  it("records the request as pending, attributed to the submitter", async () => {
    const created = await submit("material", { name: "PCTG" });

    expect(created).toMatchObject({
      entityType: "material",
      payload: { name: "PCTG" },
      status: "pending",
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it("rejects an entity type the catalog does not have", async () => {
    const response = await request(app)
      .post("/api/catalog-requests")
      .set("Cookie", aliceCookie)
      .send({ entityType: "sandwich", payload: { name: "PCTG" } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid enum value. Expected 'manufacturer' | 'material' | 'color' | 'diameter' | 'storageLocation', received 'sandwich'",
    );
  });

  // The payload is validated against the entity's own schema at submission
  // time, so an admin's review queue cannot fill with requests that could
  // never be approved.
  it("rejects a payload that does not fit the entity type", async () => {
    const response = await request(app)
      .post("/api/catalog-requests")
      .set("Cookie", aliceCookie)
      .send({ entityType: "material", payload: { nope: 1 } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Required");
  });
});

describe("GET /api/catalog-requests", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).get("/api/catalog-requests").set("Cookie", aliceCookie);

    expect(response.status).toBe(403);
  });

  it("lists the queue with the requester's name and without their user id", async () => {
    await submit("material", { name: "PCTG" });

    const response = await request(app).get("/api/catalog-requests").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ entityType: "material", status: "pending", requestedBy: "alice" });
    expect(response.body[0]).not.toHaveProperty("userId");
  });

  it("filters by status when asked", async () => {
    const first = await submit("material", { name: "PCTG" });
    await submit("color", { name: "Teal", code: "#008080" });
    await request(app).post(`/api/catalog-requests/${first.id}/approve`).set("Cookie", adminCookie).expect(200);

    const pending = await request(app).get("/api/catalog-requests").query({ status: "pending" }).set("Cookie", adminCookie);
    const approved = await request(app).get("/api/catalog-requests").query({ status: "approved" }).set("Cookie", adminCookie);

    expect(pending.body.map((r: { entityType: string }) => r.entityType)).toEqual(["color"]);
    expect(approved.body.map((r: { entityType: string }) => r.entityType)).toEqual(["material"]);
  });

  it("returns the newest request first", async () => {
    await submit("material", { name: "PCTG" });
    await submit("material", { name: "TPU95" });

    const response = await request(app).get("/api/catalog-requests").set("Cookie", adminCookie);

    expect(response.body.map((r: { payload: { name: string } }) => r.payload.name)).toEqual(["TPU95", "PCTG"]);
  });

  // The case above is racy on SQLite: created_at defaults to epoch
  // milliseconds there, and two submissions inside the same millisecond tie.
  // This pins what a tie must resolve to - the later id, which is the later
  // submission - without depending on the clock.
  it("puts the later submission first when two share a timestamp", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(catalogRequests).values([
      { userId: aliceId, entityType: "material", payload: { name: "PCTG" }, createdAt },
      { userId: aliceId, entityType: "material", payload: { name: "TPU95" }, createdAt },
    ]);

    const response = await request(app).get("/api/catalog-requests").set("Cookie", adminCookie);

    expect(response.body.map((r: { payload: { name: string } }) => r.payload.name)).toEqual(["TPU95", "PCTG"]);
  });
});

describe("GET /api/catalog-requests/mine", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).get("/api/catalog-requests/mine");

    expect(response.status).toBe(401);
  });

  it("shows a user only their own requests", async () => {
    await submit("material", { name: "PCTG" });

    const bobCookie = await registerAndVerify(app, {
      username: "bob",
      email: "bob@example.com",
      password: "bobs-password",
    });

    const mine = await request(app).get("/api/catalog-requests/mine").set("Cookie", aliceCookie);
    const bobs = await request(app).get("/api/catalog-requests/mine").set("Cookie", bobCookie);

    expect(mine.body).toHaveLength(1);
    expect(bobs.body).toEqual([]);
  });
});

describe("POST /api/catalog-requests/:id/approve", () => {
  it("rejects a non-admin", async () => {
    const created = await submit("material", { name: "PCTG" });

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/approve`)
      .set("Cookie", aliceCookie);

    expect(response.status).toBe(403);
  });

  it("rejects an id that is not a number", async () => {
    const response = await request(app)
      .post("/api/catalog-requests/not-a-number/approve")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request ID");
  });

  it("creates the real catalog entry and marks the request approved", async () => {
    const created = await submit("material", { name: "PCTG" });

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/approve`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "approved", reviewedBy: 1 });
    expect(response.body.reviewedAt).not.toBeNull();

    const materials = await storage.getMaterials(aliceId);
    expect(materials.map((m) => m.name)).toContain("PCTG");
  });

  it("emails the requester that it was approved", async () => {
    const created = await submit("material", { name: "PCTG" });
    mailbox.length = 0;

    await request(app).post(`/api/catalog-requests/${created.id}/approve`).set("Cookie", adminCookie).expect(200);

    const mail = lastMailTo(alice.email);
    expect(mail).toBeDefined();
    expect(mail!.html).toContain("PCTG");
  });

  it("reports an already-reviewed request as not found", async () => {
    const created = await submit("material", { name: "PCTG" });
    await request(app).post(`/api/catalog-requests/${created.id}/approve`).set("Cookie", adminCookie).expect(200);

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/approve`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Pending request not found");
  });

  // Two users can ask for the same thing; the catalog's unique constraint
  // decides the second one, and the admin gets told rather than seeing a 500.
  it("explains that the entry already exists rather than failing outright", async () => {
    const first = await submit("material", { name: "PCTG" });
    const second = await submit("material", { name: "PCTG" });
    await request(app).post(`/api/catalog-requests/${first.id}/approve`).set("Cookie", adminCookie).expect(200);

    const response = await request(app)
      .post(`/api/catalog-requests/${second.id}/approve`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Could not create this entry - it may already exist in the catalog",
    );
  });
});

describe("POST /api/catalog-requests/:id/reject", () => {
  it("rejects a non-admin", async () => {
    const created = await submit("material", { name: "PCTG" });

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", aliceCookie);

    expect(response.status).toBe(403);
  });

  it("records the rejection with its note, and creates nothing", async () => {
    const created = await submit("material", { name: "PCTG" });

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", adminCookie)
      .send({ note: "we already call this PETG" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "rejected",
      reviewNote: "we already call this PETG",
      reviewedBy: 1,
    });

    const materials = await storage.getMaterials(aliceId);
    expect(materials.map((m) => m.name)).not.toContain("PCTG");
  });

  it("accepts a rejection with no note", async () => {
    const created = await submit("material", { name: "PCTG" });

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.reviewNote).toBeNull();
  });

  it("emails the requester that it was rejected", async () => {
    const created = await submit("material", { name: "PCTG" });
    mailbox.length = 0;

    await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", adminCookie)
      .send({ note: "not this one" })
      .expect(200);

    expect(lastMailTo(alice.email)).toBeDefined();
  });

  it("reports an already-reviewed request as not found", async () => {
    const created = await submit("material", { name: "PCTG" });
    await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", adminCookie)
      .send({})
      .expect(200);

    const response = await request(app)
      .post(`/api/catalog-requests/${created.id}/reject`)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(404);
  });

  // The admin who created the account through the bootstrap has no email
  // address, so a request from them cannot be notified about - and the review
  // still has to succeed.
  it("still reviews a request from a user with no email address", async () => {
    const bob = await request(app)
      .post("/api/catalog-requests")
      .set("Cookie", adminCookie)
      .send({ entityType: "material", payload: { name: "PCTG" } });
    expect(bob.status).toBe(201);
    mailbox.length = 0;

    const response = await request(app)
      .post(`/api/catalog-requests/${bob.body.id}/reject`)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(mailbox).toHaveLength(0);
  });
});
