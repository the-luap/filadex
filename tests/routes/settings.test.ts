/**
 * Characterisation tests for server/utils/settings-crud.ts under the
 * `userScoped` capability, which only `materials` declares: a Global Catalog
 * (rows owned by nobody) plus a Personal Catalog per user.
 *
 * The other four entities (manufacturers, colors, diameters, storage locations)
 * go through the same factory and must be untouched by it - a couple of their
 * cases are pinned here alongside.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerSettingsRoutes } from "../../server/routes/settings";
import { initializeAdminUser } from "../../server/auth";
import { storage } from "../../server/storage";
import { db } from "../helpers/db";
import { materials, users } from "../../shared/schema";
import { createApp, loginAs, registerAndVerify } from "../helpers/app";

let app: Express;
let adminCookie: string;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const PASSWORD = "correct-horse"; // ggignore

async function newUser(username: string) {
  const cookie = await registerAndVerify(app, {
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
  });
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  return { cookie, id: me.body.id as number };
}

const names = (body: Array<{ name: string }>) => body.map((m) => m.name).sort();
const allMaterialRows = () => db.select().from(materials);

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerSettingsRoutes);
  await initializeAdminUser();
  adminCookie = await loginAs(app, "admin", "admin");
});

describe("GET /api/materials", () => {
  it("shows a non-admin the Global Catalog plus their own Personal Catalog, and no one else's", async () => {
    await storage.createMaterial({ name: "PLA" });
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    await db.insert(materials).values([
      { userId: alice.id, name: "AliceOnly" },
      { userId: bob.id, name: "BobOnly" },
    ]);

    const res = await request(app).get("/api/materials").set("Cookie", alice.cookie);

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(["AliceOnly", "PLA"]);
  });

  // The Global Catalog is the curated list an admin has put in reorder order;
  // a Personal Catalog entry is whatever the user happened to type on a Spool,
  // so it belongs after that list rather than interleaved into it - both
  // default to sort_order 999 and would otherwise mix.
  it("lists the Global Catalog in its own order, then the caller's own entries by name", async () => {
    const alice = await newUser("alice");
    await storage.createMaterial({ name: "PETG" });
    const [pla] = await db.insert(materials).values({ name: "PLA" }).returning();
    await storage.updateMaterialOrder(pla.id, 1);
    await db.insert(materials).values([
      { userId: alice.id, name: "Zylon" },
      { userId: alice.id, name: "MoonPLA" },
    ]);

    const res = await request(app).get("/api/materials").set("Cookie", alice.cookie);

    expect(res.body.map((m: { name: string }) => m.name)).toEqual(["PLA", "PETG", "MoonPLA", "Zylon"]);
  });

  // The client tells the three cases apart from these facts alone (no status
  // enum): userId null is the Global Catalog; userId set with density/
  // isHygroscopic still at the auto-registration defaults needs attention;
  // userId set with either filled in does not. See
  // docs/plans/per-user-material-catalog-ui.md, Commit 1.
  it("returns userId, density and isHygroscopic so the client can tell a global row from a filled-in or still-default personal one", async () => {
    const alice = await newUser("alice");
    await storage.createMaterial({ name: "PLA", density: "1.24", isHygroscopic: false });
    await db.insert(materials).values([
      { userId: alice.id, name: "Filled", density: "1.27", isHygroscopic: true },
      { userId: alice.id, name: "StillDefault", density: null, isHygroscopic: false },
    ]);

    const res = await request(app).get("/api/materials").set("Cookie", alice.cookie);

    const byName = (name: string) => res.body.find((m: any) => m.name === name);
    expect(byName("PLA")).toMatchObject({ userId: null, density: "1.24", isHygroscopic: false });
    expect(byName("Filled")).toMatchObject({ userId: alice.id, density: "1.27", isHygroscopic: true });
    expect(byName("StillDefault")).toMatchObject({ userId: alice.id, density: null, isHygroscopic: false });
  });
});

describe("POST /api/materials", () => {
  it("is still 403 for a non-admin", async () => {
    const alice = await newUser("alice");

    const res = await request(app).post("/api/materials").set("Cookie", alice.cookie).send({ name: "Nope" });

    expect(res.status).toBe(403);
    expect(await allMaterialRows()).toHaveLength(0);
  });

  it("creates a Global Catalog row for an admin", async () => {
    const res = await request(app).post("/api/materials").set("Cookie", adminCookie).send({ name: "PLA" });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeNull();
  });

  // Every install ships PLA/PETG/ABS/TPU, so retyping one in the Add Material
  // form is the ordinary case, not an edge one. The Global Catalog's uniqueness
  // is case-insensitive, so the answer has to be the same whatever the case.
  it("answers 409 rather than erroring when the Global Catalog already holds that name", async () => {
    await storage.createMaterial({ name: "PETG" });

    const res = await request(app).post("/api/materials").set("Cookie", adminCookie).send({ name: "petg" });

    expect(res.status).toBe(409);
    expect(await allMaterialRows()).toHaveLength(1);
  });

  it("stores the name the way the catalog matches it, without surrounding whitespace", async () => {
    const res = await request(app).post("/api/materials").set("Cookie", adminCookie).send({ name: " PETG " });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("PETG");
  });

  // A Personal Catalog row of the same name is a different row, and the two
  // partial unique indexes let them coexist - so it must not block the create.
  it("still creates a Global Catalog row when only someone's Personal Catalog holds that name", async () => {
    const alice = await newUser("alice");
    await db.insert(materials).values({ userId: alice.id, name: "MoonPLA" });

    const res = await request(app).post("/api/materials").set("Cookie", adminCookie).send({ name: "MoonPLA" });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeNull();
  });
});

describe("DELETE /api/materials/:id", () => {
  it("lets a non-admin delete a row they own", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly" }).returning();

    const res = await request(app).delete(`/api/materials/${row.id}`).set("Cookie", alice.cookie);

    expect(res.status).toBe(204);
    expect(await allMaterialRows()).toHaveLength(0);
  });

  it("refuses a non-admin deleting a Global Catalog row", async () => {
    const global = await storage.createMaterial({ name: "PLA" });
    const alice = await newUser("alice");

    const res = await request(app).delete(`/api/materials/${global.id}`).set("Cookie", alice.cookie);

    expect(res.status).toBe(403);
    expect(await allMaterialRows()).toHaveLength(1);
  });

  it("does not let a non-admin reach another user's Personal Catalog row", async () => {
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    const [bobRow] = await db.insert(materials).values({ userId: bob.id, name: "BobOnly" }).returning();

    const res = await request(app).delete(`/api/materials/${bobRow.id}`).set("Cookie", alice.cookie);

    expect(res.status).toBe(404);
    expect(await allMaterialRows()).toHaveLength(1);
  });

  it("still blocks deleting a Catalog Material one of the caller's Spools uses", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "InUse" }).returning();
    await storage.createFilament({
      userId: alice.id,
      name: "spool",
      material: "InUse",
      colorName: "Black",
      totalWeight: "1000",
      remainingPercentage: "50",
    });

    const res = await request(app).delete(`/api/materials/${row.id}`).set("Cookie", alice.cookie);

    expect(res.status).toBe(400);
    expect(await allMaterialRows()).toHaveLength(1);
  });

  it("lets an admin delete a Global Catalog row", async () => {
    const global = await storage.createMaterial({ name: "PLA" });

    const res = await request(app).delete(`/api/materials/${global.id}`).set("Cookie", adminCookie);

    expect(res.status).toBe(204);
  });
});

describe("PUT /api/materials/:id", () => {
  it("lets a non-admin fill in density and isHygroscopic on a row they own", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly" }).returning();

    const res = await request(app)
      .put(`/api/materials/${row.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "1.24", isHygroscopic: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ density: "1.24", isHygroscopic: true });
  });

  it("refuses a non-admin editing a Global Catalog row", async () => {
    const global = await storage.createMaterial({ name: "PLA" });
    const alice = await newUser("alice");

    const res = await request(app)
      .put(`/api/materials/${global.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "1.24" });

    expect(res.status).toBe(403);
  });

  it("refuses a non-admin editing another user's Personal Catalog row", async () => {
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    const [bobRow] = await db.insert(materials).values({ userId: bob.id, name: "BobOnly" }).returning();

    const res = await request(app)
      .put(`/api/materials/${bobRow.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "1.24" });

    expect(res.status).toBe(404);
  });

  it("lets an admin edit a Global Catalog row", async () => {
    const global = await storage.createMaterial({ name: "PLA" });

    const res = await request(app)
      .put(`/api/materials/${global.id}`)
      .set("Cookie", adminCookie)
      .send({ density: "1.24", isHygroscopic: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ density: "1.24", isHygroscopic: false });
  });

  it("accepts just one of the two fields, leaving the other as it was", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly", isHygroscopic: true }).returning();

    const res = await request(app)
      .put(`/api/materials/${row.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "1.24" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ density: "1.24", isHygroscopic: true });
  });

  it("rejects an empty body rather than erroring", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly" }).returning();

    const res = await request(app).put(`/api/materials/${row.id}`).set("Cookie", alice.cookie).send({});

    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric density instead of erroring against the database", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly" }).returning();

    const res = await request(app)
      .put(`/api/materials/${row.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "not-a-number" });

    expect(res.status).toBe(400);
  });
});

describe("ownership is decided by role, not the is_admin mirror", () => {
  // shared/schema.ts documents `role` as the source of truth and `is_admin` as
  // a backward-compatibility mirror. This is the only authorization decision in
  // the codebase that read the mirror; every other gate is requireRole("admin").
  it("refuses a user whose is_admin mirror says admin but whose role does not", async () => {
    const global = await storage.createMaterial({ name: "PLA" });
    const alice = await newUser("alice");
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, alice.id));

    const put = await request(app)
      .put(`/api/materials/${global.id}`)
      .set("Cookie", alice.cookie)
      .send({ density: "1.24" });
    const del = await request(app).delete(`/api/materials/${global.id}`).set("Cookie", alice.cookie);

    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
  });
});

describe("PATCH /api/materials/:id/order", () => {
  it("reorders a Global Catalog row for an admin", async () => {
    const global = await storage.createMaterial({ name: "PLA" });

    const res = await request(app)
      .patch(`/api/materials/${global.id}/order`)
      .set("Cookie", adminCookie)
      .send({ newOrder: 2 });

    expect(res.status).toBe(200);
    expect(res.body.sortOrder).toBe(2);
  });

  // The one materials route that used to write by id alone. A Personal Catalog
  // row is not in the admin's own list and they cannot see it, so an admin
  // rewriting its sort_order is an unscoped write on a per-user table.
  it("does not let an admin reorder a row in someone else's Personal Catalog", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "AliceOnly", sortOrder: 999 }).returning();

    const res = await request(app)
      .patch(`/api/materials/${row.id}/order`)
      .set("Cookie", adminCookie)
      .send({ newOrder: 1 });

    expect(res.status).toBe(404);
    const [after] = await db.select().from(materials).where(eq(materials.id, row.id));
    expect(after.sortOrder).toBe(999);
  });
});

describe("dismissing the needs-attention flag", () => {
  // A personal row with no density and no hygroscopic flag is flagged so the
  // owner knows auto-registration happened. But a material that genuinely has
  // neither is indistinguishable from one never looked at, so the flag has to
  // be dismissible or it stays on forever with nothing the owner can do.
  it("lets the owner dismiss it, and says so in the listing", async () => {
    const alice = await newUser("alice");
    const [row] = await db.insert(materials).values({ userId: alice.id, name: "MoonPLA" }).returning();

    const before = await request(app).get("/api/materials").set("Cookie", alice.cookie);
    expect(before.body[0].attentionDismissed).toBe(false);

    const res = await request(app)
      .put(`/api/materials/${row.id}`)
      .set("Cookie", alice.cookie)
      .send({ attentionDismissed: true });

    expect(res.status).toBe(200);
    const after = await request(app).get("/api/materials").set("Cookie", alice.cookie);
    expect(after.body[0].attentionDismissed).toBe(true);
  });

  it("refuses a non-admin dismissing it on another user's row", async () => {
    const alice = await newUser("alice");
    const bob = await newUser("bob");
    const [row] = await db.insert(materials).values({ userId: bob.id, name: "MoonPLA" }).returning();

    const res = await request(app)
      .put(`/api/materials/${row.id}`)
      .set("Cookie", alice.cookie)
      .send({ attentionDismissed: true });

    expect(res.status).toBe(404);
  });
});

describe("the non-scoped entities go through the same factory unchanged", () => {
  it("lets any authenticated user list manufacturers", async () => {
    await storage.createManufacturer({ name: "Bambu Lab" });
    const alice = await newUser("alice");

    const res = await request(app).get("/api/manufacturers").set("Cookie", alice.cookie);

    expect(names(res.body)).toEqual(["Bambu Lab"]);
  });

  it("still refuses a non-admin creating a manufacturer", async () => {
    const alice = await newUser("alice");

    const res = await request(app).post("/api/manufacturers").set("Cookie", alice.cookie).send({ name: "X" });

    expect(res.status).toBe(403);
  });

  it("still refuses a non-admin deleting a manufacturer", async () => {
    const manufacturer = await storage.createManufacturer({ name: "Bambu Lab" });
    const alice = await newUser("alice");

    const res = await request(app).delete(`/api/manufacturers/${manufacturer.id}`).set("Cookie", alice.cookie);

    expect(res.status).toBe(403);
  });
});

// Both engines have to answer the same way here, and left to the database they
// do not: SQLite's LOWER() folds ASCII only, and `numeric` is TEXT there.
describe("catalog matching agrees across dialects", () => {
  it("resolves a declared material whose case differs outside ASCII", async () => {
    const alice = await newUser("alice");
    await db.insert(materials).values({ userId: alice.id, name: "äbs", density: "1.04", isHygroscopic: true });

    const resolved = await storage.resolveMaterial(alice.id, "Äbs");

    expect(resolved?.name).toBe("äbs");
    expect(resolved?.isHygroscopic).toBe(true);
  });

  it("answers 409 for a Catalog Material whose case differs outside ASCII", async () => {
    await storage.createMaterial({ name: "äbs" });

    const res = await request(app).post("/api/materials").set("Cookie", adminCookie).send({ name: "Äbs" });

    expect(res.status).toBe(409);
    expect(await allMaterialRows()).toHaveLength(1);
  });

  it("treats two spellings of the same diameter as one", async () => {
    const created = await request(app).post("/api/diameters").set("Cookie", adminCookie).send({ value: "1.75" });
    expect(created.status).toBe(201);

    const duplicate = await request(app).post("/api/diameters").set("Cookie", adminCookie).send({ value: "1.750" });

    expect(duplicate.status).toBe(409);
  });

  // The in-use guard has to read a diameter the same way everything else does. On
  // exact string equality a catalog entry spelled "1.750" looks unused to spools
  // carrying "1.75", and deleting it removes a diameter that is in use - the one
  // thing the guard exists to prevent.
  it("refuses to delete a diameter a spool uses under a different spelling", async () => {
    const created = await request(app).post("/api/diameters").set("Cookie", adminCookie).send({ value: "1.750" });
    expect(created.status).toBe(201);

    const admin = await storage.getUserByUsername("admin");
    await storage.createFilament({
      userId: admin!.id,
      name: "A spool",
      material: "PLA",
      colorName: "Black",
      diameter: "1.75",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    const deleted = await request(app)
      .delete(`/api/diameters/${created.body.id}`)
      .set("Cookie", adminCookie);

    expect(deleted.status).toBe(400);
    const remaining = await request(app).get("/api/diameters").set("Cookie", adminCookie);
    expect(remaining.body).toHaveLength(1);
  });
});
