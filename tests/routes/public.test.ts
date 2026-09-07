/**
 * Characterisation tests for server/routes/public.ts - the unauthenticated
 * sharing path, driven through the /api/user-sharing endpoint that controls it.
 *
 * These record observable behaviour at the HTTP boundary, so that moving the
 * database access behind IStorage can be shown to change nothing. They are not
 * a specification: a behaviour change belongs in its own commit, together with
 * the test that pins it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerPublicRoutes } from "../../server/routes/public";
import { registerUserRoutes } from "../../server/routes/users";
import { storage } from "../../server/storage";
import { db } from "../helpers/db";
import { userSharing } from "../../shared/schema";
import { createApp, registerAndVerify } from "../helpers/app";

let app: Express;
let aliceCookie: string;
let aliceId: number;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerPublicRoutes, registerUserRoutes);
  aliceCookie = await registerAndVerify(app, alice);
  const me = await request(app).get("/api/auth/me").set("Cookie", aliceCookie);
  aliceId = me.body.id;
});

/** Gives Alice a spool of the given material, through the storage interface the app itself uses. */
async function giveAliceASpoolOf(material: string, name = `${material} spool`) {
  return storage.createFilament({
    userId: aliceId,
    name,
    material,
    colorName: "Black",
    totalWeight: "1000",
    remainingPercentage: "80",
  });
}

async function share(cookie: string, body: Record<string, unknown>) {
  const response = await request(app).post("/api/user-sharing").set("Cookie", cookie).send(body);
  expect(response.status).toBe(201);
  return response.body;
}

describe("GET /api/public/filaments/:userId", () => {
  it("rejects a user id that is not a number", async () => {
    const response = await request(app).get("/api/public/filaments/not-a-number");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID");
  });

  // The same answer as for a user who shares nothing, so the endpoint cannot be
  // used to list which ids are accounts.
  it("answers an unknown user exactly like a user who shares nothing", async () => {
    const response = await request(app).get("/api/public/filaments/9999");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No public filaments found");
  });

  it("shows the product, not the purchase", async () => {
    await storage.createFilament({
      userId: aliceId,
      name: "Orange PETG",
      material: "PETG",
      colorName: "Orange",
      totalWeight: "1000",
      remainingPercentage: "80",
      purchasePrice: "29.99",
      purchaseDate: "2026-01-01",
      storageLocation: "Top shelf, left",
      customFieldValues: { "1": "batch 7" },
    });
    await share(aliceCookie, { isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.filaments).toHaveLength(1);
    expect(Object.keys(response.body.filaments[0]).sort()).toEqual([
      "colorCode", "colorName", "diameter", "id", "manufacturer", "material", "name", "printTemp", "remainingPercentage",
    ]);
  });

  it("reports a user who has shared nothing as having no public filaments", async () => {
    await giveAliceASpoolOf("PLA");

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No public filaments found");
  });

  it("treats sharing that has been switched off as no sharing at all", async () => {
    await giveAliceASpoolOf("PLA");
    await share(aliceCookie, { isPublic: false });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No public filaments found");
  });

  it("returns every filament when sharing is global, with the owner's name but not their email", async () => {
    await giveAliceASpoolOf("PLA");
    await giveAliceASpoolOf("PETG");
    await share(aliceCookie, { isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ id: aliceId, username: "alice" });
    expect(response.body.filaments.map((f: { material: string }) => f.material).sort()).toEqual([
      "PETG",
      "PLA",
    ]);
  });

  it("returns only the shared material when sharing is per-material", async () => {
    await giveAliceASpoolOf("PLA");
    await giveAliceASpoolOf("PETG");
    const petg = await storage.createMaterial({ name: "PETG" });
    await share(aliceCookie, { materialId: petg.id, isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.filaments).toHaveLength(1);
    expect(response.body.filaments[0].material).toBe("PETG");
  });

  it("does not leak another user's filaments", async () => {
    await giveAliceASpoolOf("PLA");
    await share(aliceCookie, { isPublic: true });

    const bobCookie = await registerAndVerify(app, {
      username: "bob",
      email: "bob@example.com",
      password: "bobs-password",
    });
    const bob = await request(app).get("/api/auth/me").set("Cookie", bobCookie);
    await storage.createFilament({
      userId: bob.body.id,
      name: "Bob's spool",
      material: "ABS",
      colorName: "White",
      totalWeight: "1000",
      remainingPercentage: "50",
    });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.body.filaments.map((f: { name: string }) => f.name)).toEqual(["PLA spool"]);
  });

  it("lets a public global row widen the share past a narrower per-material row", async () => {
    await giveAliceASpoolOf("PLA");
    await giveAliceASpoolOf("PETG");
    const petg = await storage.createMaterial({ name: "PETG" });
    await share(aliceCookie, { materialId: petg.id, isPublic: true });
    await share(aliceCookie, { isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.filaments).toHaveLength(2);
  });

  // Deleting the catalogue entry cascades the user_sharing row away with it, so
  // the share is silently revoked rather than left dangling.
  it("revokes the share when the shared material is deleted from the catalogue", async () => {
    await giveAliceASpoolOf("PETG");
    const petg = await storage.createMaterial({ name: "PETG" });
    await share(aliceCookie, { materialId: petg.id, isPublic: true });
    await storage.deleteMaterial(petg.id);

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No public filaments found");
  });

  it("returns an empty list when a shared material matches none of the owner's filaments", async () => {
    await giveAliceASpoolOf("PLA");
    const abs = await storage.createMaterial({ name: "ABS" });
    await share(aliceCookie, { materialId: abs.id, isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.filaments).toEqual([]);
  });

  // A filament records its material as free text while user_sharing.material_id
  // points at the materials catalogue, so the two are matched by name, ignoring
  // case - otherwise a spool entered as "petg" would not be covered by sharing
  // the catalogue's "PETG".
  it("matches a filament whose material differs from the catalogue name only in case", async () => {
    await giveAliceASpoolOf("petg");
    const petg = await storage.createMaterial({ name: "PETG" });
    await share(aliceCookie, { materialId: petg.id, isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(200);
    expect(response.body.filaments).toHaveLength(1);
    expect(response.body.filaments[0].material).toBe("petg");
  });

  it("still excludes filaments of a material that was not shared", async () => {
    await giveAliceASpoolOf("PLA");
    await giveAliceASpoolOf("petg");
    const petg = await storage.createMaterial({ name: "PETG" });
    await share(aliceCookie, { materialId: petg.id, isPublic: true });

    const response = await request(app).get(`/api/public/filaments/${aliceId}`);

    expect(response.body.filaments.map((f: { material: string }) => f.material)).toEqual(["petg"]);
  });
});

describe("switching sharing off through /api/user-sharing", () => {
  it("makes the collection private again", async () => {
    const withUserRoutes = createApp(registerAuthRoutes, registerPublicRoutes, registerUserRoutes);
    await giveAliceASpoolOf("PLA");

    await request(withUserRoutes)
      .post("/api/user-sharing")
      .set("Cookie", aliceCookie)
      .send({ isPublic: true })
      .expect(201);
    await request(withUserRoutes)
      .post("/api/user-sharing")
      .set("Cookie", aliceCookie)
      .send({ isPublic: false })
      .expect(201);

    const response = await request(withUserRoutes).get(`/api/public/filaments/${aliceId}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No public filaments found");
  });

  // Every release before the one that fixed it left a duplicate global row
  // behind on each toggle, so an upgraded database arrives with several - and
  // getPublicUserSharing takes any row with is_public, so one stale `true` is
  // enough to keep a collection public. Switching sharing off has to collapse
  // them, or it can never undo the damage.
  it("collapses duplicate global rows left by an older release", async () => {
    await giveAliceASpoolOf("PLA");
    await db.insert(userSharing).values([
      { userId: aliceId, materialId: null, isPublic: true },
      { userId: aliceId, materialId: null, isPublic: false },
      { userId: aliceId, materialId: null, isPublic: true },
    ]);

    await request(app)
      .post("/api/user-sharing")
      .set("Cookie", aliceCookie)
      .send({ isPublic: false })
      .expect(201);

    const listed = await request(app).get("/api/user-sharing").set("Cookie", aliceCookie);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].isPublic).toBe(false);

    const publicView = await request(app).get(`/api/public/filaments/${aliceId}`);
    expect(publicView.status).toBe(404);
  });
});
