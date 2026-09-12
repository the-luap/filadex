/**
 * Characterisation tests for the auto-registration of declared materials.
 *
 * A declared material that resolves to no Catalog Material is registered into
 * the declaring user's Personal Catalog, so from then on it always resolves to
 * a row (docs/adr/0003-per-user-material-catalog.md). These record that at the
 * storage seam plus GET /api/materials; they are not a specification.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerSettingsRoutes } from "../../server/routes/settings";
import { registerFilamentRoutes } from "../../server/routes/filaments";
import { storage } from "../../server/storage";
import { db } from "../helpers/db";
import { materials, manufacturers } from "../../shared/schema";
import { createApp, registerAndVerify } from "../helpers/app";

let app: Express;

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

/** Records a spool of the given material, through the storage interface the app itself uses. */
async function giveSpoolOf(userId: number, material: string) {
  return storage.createFilament({
    userId,
    name: `${material} spool`,
    material,
    colorName: "Black",
    totalWeight: "1000",
    remainingPercentage: "80",
  });
}

/** The rows a user owns in their Personal Catalog. */
const ownRows = (userId: number) => db.select().from(materials).where(eq(materials.userId, userId));

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerSettingsRoutes, registerFilamentRoutes);
});

describe("auto-registration of a declared material", () => {
  it("registers a material in no catalog into the declaring user's Personal Catalog", async () => {
    const alice = await newUser("alice");

    await giveSpoolOf(alice.id, "MoonPLA");

    const rows = await ownRows(alice.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "MoonPLA",
      userId: alice.id,
      density: null,
      isHygroscopic: false,
    });
  });

  it("gives each user their own private row for an identically-named new material", async () => {
    const alice = await newUser("alice");
    const bob = await newUser("bob");

    await giveSpoolOf(alice.id, "MoonPLA");
    await giveSpoolOf(bob.id, "MoonPLA");

    const aliceRow = (await ownRows(alice.id))[0];
    const bobRow = (await ownRows(bob.id))[0];
    expect(aliceRow.id).not.toBe(bobRow.id);

    const aliceView = await request(app).get("/api/materials").set("Cookie", alice.cookie);
    const bobView = await request(app).get("/api/materials").set("Cookie", bob.cookie);
    expect(aliceView.body.map((m: { id: number }) => m.id)).toEqual([aliceRow.id]);
    expect(bobView.body.map((m: { id: number }) => m.id)).toEqual([bobRow.id]);
  });

  it("resolves to the Global Catalog row, creating nothing, when only the case differs", async () => {
    const alice = await newUser("alice");
    await storage.createMaterial({ name: "PETG" });

    await giveSpoolOf(alice.id, "petg");

    expect(await ownRows(alice.id)).toHaveLength(0);
    const view = await request(app).get("/api/materials").set("Cookie", alice.cookie);
    expect(view.body.map((m: { name: string }) => m.name)).toEqual(["PETG"]);
  });

  it("resolves to the user's own row when a Global Catalog row of the same name also exists", async () => {
    const alice = await newUser("alice");
    const [own] = await db.insert(materials).values({ userId: alice.id, name: "Dualite" }).returning();
    await storage.createMaterial({ name: "Dualite" });

    const resolved = await storage.resolveMaterial(alice.id, "dualite");

    expect(resolved?.id).toBe(own.id);
    expect(resolved?.userId).toBe(alice.id);
  });

  // A trailing space out of a CSV column or a paste is enough to make a
  // declared material miss the curated row it obviously means, and the miss is
  // silent: the spool loses the density and the hygroscopic flag, and the
  // owner's settings list fills with rows that look identical.
  it("resolves to the Global Catalog row, creating nothing, when the declared material is padded with whitespace", async () => {
    const alice = await newUser("alice");
    await storage.createMaterial({ name: "PETG", density: "1.27", isHygroscopic: true });

    await giveSpoolOf(alice.id, " PETG");

    expect(await ownRows(alice.id)).toHaveLength(0);
    expect((await storage.resolveMaterial(alice.id, " PETG"))?.density).toBe("1.27");
  });

  it("registers one row for a new material however it is padded", async () => {
    const alice = await newUser("alice");

    await giveSpoolOf(alice.id, "MoonPLA");
    await giveSpoolOf(alice.id, " MoonPLA ");
    await giveSpoolOf(alice.id, "MoonPLA ");

    expect((await ownRows(alice.id)).map((row) => row.name)).toEqual(["MoonPLA"]);
  });

  it("creates nothing when the material is already in the user's Personal Catalog", async () => {
    const alice = await newUser("alice");

    await giveSpoolOf(alice.id, "MoonPLA");
    await giveSpoolOf(alice.id, "moonpla");

    expect(await ownRows(alice.id)).toHaveLength(1);
  });

  // Blank is not a material. The Spool form requires one, but an import or a
  // direct API call can still leave it empty, and a nameless Catalog Material
  // in the settings list is worse than none.
  it("creates nothing when the declared material is blank", async () => {
    const alice = await newUser("alice");

    await giveSpoolOf(alice.id, "");
    await giveSpoolOf(alice.id, "   ");

    expect(await ownRows(alice.id)).toHaveLength(0);
  });
});

describe("filament type reuse across dialects", () => {
  // `t.numeric` is a real numeric on Postgres and TEXT on SQLite, so a plain `=`
  // deduped "1.750" against "1.75" on one engine and not the other - the same
  // CSV import producing one filament type or two depending on the install.
  it("reuses one filament type for two spellings of the same diameter", async () => {
    const alice = await newUser("alice");

    const first = await storage.createFilament({
      userId: alice.id,
      name: "First spool",
      material: "PLA",
      colorName: "Black",
      diameter: "1.75",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    const second = await storage.createFilament({
      userId: alice.id,
      name: "Second spool",
      material: "PLA",
      colorName: "Black",
      diameter: "1.750",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    expect(second.filamentTypeId).toBe(first.filamentTypeId);
  });

  // The numeric match that fix relies on is a CAST on SQLite, and CAST stops at
  // the first non-numeric character: "1.75mm" and "" would both compare equal to
  // a real diameter and hand the spool a filament type it does not belong to.
  // Postgres errors on the same parameter instead. Neither is allowed to happen.
  it.each(["1.75mm", "", "   ", "abc"])("refuses %o as a diameter", async (value) => {
    const alice = await newUser("alice");

    await expect(storage.createFilament({
      userId: alice.id,
      name: "Bad spool",
      material: "PLA",
      colorName: "Black",
      diameter: value,
      totalWeight: "1000",
      remainingPercentage: "80",
    })).rejects.toThrow();

    expect(await storage.getFilaments(alice.id)).toHaveLength(0);
  });

  it("refuses a non-numeric diameter on update too", async () => {
    const alice = await newUser("alice");
    const spool = await storage.createFilament({
      userId: alice.id,
      name: "Good spool",
      material: "PLA",
      colorName: "Black",
      diameter: "1.75",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    await expect(storage.updateFilament(spool.id, { diameter: "1.75mm" }, alice.id)).rejects.toThrow();

    const unchanged = await storage.getFilament(spool.id, alice.id);
    expect(unchanged?.diameter).toBe("1.75");
  });
});

describe("auto-registration of a declared manufacturer", () => {
  it("registers a manufacturer when creating a filament if one with such a name does not exist", async () => {
    const alice = await newUser("alice_mfg");
    await storage.createFilament({
      userId: alice.id,
      name: "Custom spool",
      manufacturer: "NewBrand",
      material: "PLA",
      colorName: "Black",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    const mfgRows = await db.select().from(manufacturers);
    const found = mfgRows.find((m) => m.name === "NewBrand");
    expect(found).toBeDefined();
    expect(found?.userId).toBe(alice.id);

    const view = await request(app).get("/api/manufacturers").set("Cookie", alice.cookie);
    expect(view.body.map((m: { name: string }) => m.name)).toContain("NewBrand");

    const bob = await newUser("bob_mfg_view");
    const bobView = await request(app).get("/api/manufacturers").set("Cookie", bob.cookie);
    expect(bobView.body.map((m: { name: string }) => m.name)).not.toContain("NewBrand");
  });

  it("does not duplicate an existing manufacturer when case differs", async () => {
    const alice = await newUser("alice_mfg2");
    await storage.createManufacturer({ name: "Polymaker" });

    await storage.createFilament({
      userId: alice.id,
      name: "Poly spool",
      manufacturer: "polymaker",
      material: "PLA",
      colorName: "Black",
      totalWeight: "1000",
      remainingPercentage: "80",
    });

    const mfgRows = await db.select().from(manufacturers);
    const polyMatches = mfgRows.filter((m) => m.name.toLowerCase() === "polymaker");
    expect(polyMatches).toHaveLength(1);
  });

  it("populates density on newly created personal material catalog entry when supplied", async () => {
    const alice = await newUser("alice_density");

    const response = await request(app)
      .post("/api/filaments")
      .set("Cookie", alice.cookie)
      .send({
        name: "Custom PCTG Spool",
        material: "PCTG",
        density: 1.23,
        colorName: "Clear",
        colorCode: "#FFFFFF",
        totalWeight: 1000,
        remainingPercentage: 100,
      });

    expect(response.status).toBe(201);

    const materialList = await request(app)
      .get("/api/materials")
      .set("Cookie", alice.cookie);

    const pctg = materialList.body.find((m: { name: string; density: string | null }) => m.name === "PCTG");
    expect(pctg).toBeDefined();
    expect(pctg.density).not.toBeNull();
    expect(Number(pctg.density)).toBe(1.23);
  });

  it("rejects non-numeric or non-positive density with 400", async () => {
    const alice = await newUser("alice_bad_density");
    for (const invalidDensity of ["abc", "0", 0, "-1.2", -1.2]) {
      const response = await request(app)
        .post("/api/filaments")
        .set("Cookie", alice.cookie)
        .send({
          name: "Bad Density Spool",
          material: "NovelMat1",
          density: invalidDensity,
          colorName: "Red",
          colorCode: "#FF0000",
          totalWeight: 1000,
          remainingPercentage: 100,
        });

      expect(response.status).toBe(400);
    }
  });

  it("safely handles density in storage.updateFilament without leaking column update", async () => {
    const alice = await newUser("alice_update_density");
    const spool = await storage.createFilament({
      userId: alice.id,
      name: "Update Spool",
      material: "PETG",
      colorName: "Blue",
      totalWeight: "1000",
      remainingPercentage: "100",
    });

    // Updating filament with density should not attempt to update non-existent filaments.density column
    const updated = await storage.updateFilament(spool.id, { density: "1.25" } as any, alice.id);
    expect(updated).toBeDefined();
    expect(updated?.id).toBe(spool.id);
  });

  it("handles concurrent creation of filaments declaring the same new manufacturer", async () => {
    const alice = await newUser("alice_mfg_concurrent");
    const [spool1, spool2] = await Promise.all([
      storage.createFilament({
        userId: alice.id,
        name: "Spool 1",
        manufacturer: "concurrentbrand",
        material: "PLA",
        colorName: "Black",
        totalWeight: "1000",
        remainingPercentage: "80",
      }),
      storage.createFilament({
        userId: alice.id,
        name: "Spool 2",
        manufacturer: "ConcurrentBrand",
        material: "PLA",
        colorName: "White",
        totalWeight: "1000",
        remainingPercentage: "80",
      }),
    ]);

    // Both spools should resolve to the same canonical manufacturer name regardless of race winner
    expect(spool1.manufacturer).toBe(spool2.manufacturer);
    expect(["concurrentbrand", "ConcurrentBrand"]).toContain(spool1.manufacturer);

    const mfgRows = await db.select().from(manufacturers);
    const matches = mfgRows.filter((m) => m.name.toLowerCase() === "concurrentbrand");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe(spool1.manufacturer);
  });

  it("does not insert manufacturer into personal catalog when saveManufacturer is false", async () => {
    const alice = await newUser("alice_mfg_nopersist");
    const res = await request(app)
      .post("/api/filaments")
      .set("Cookie", alice.cookie)
      .send({
        name: "Temporary Spool",
        manufacturer: "TempBrandNoSave",
        material: "PLA",
        colorName: "Black",
        colorCode: "#000000",
        totalWeight: 1000,
        remainingPercentage: 100,
        saveManufacturer: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.manufacturer).toBe("TempBrandNoSave");

    const mfgRows = await db.select().from(manufacturers).where(eq(manufacturers.userId, alice.id));
    const match = mfgRows.find((m) => m.name.toLowerCase() === "tempbrandnosave");
    expect(match).toBeUndefined();
  });

  it("does not insert material into personal catalog when saveMaterial is false", async () => {
    const alice = await newUser("alice_mat_nopersist");
    const res = await request(app)
      .post("/api/filaments")
      .set("Cookie", alice.cookie)
      .send({
        name: "Temporary Material Spool",
        material: "TempMatNoSave",
        colorName: "Black",
        colorCode: "#000000",
        totalWeight: 1000,
        remainingPercentage: 100,
        saveMaterial: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.material).toBe("TempMatNoSave");

    const matRows = await ownRows(alice.id);
    const match = matRows.find((m) => m.name.toLowerCase() === "tempmatnosave");
    expect(match).toBeUndefined();
  });

  it("persists manufacturer and material to personal catalog by default when save flags are omitted", async () => {
    const alice = await newUser("alice_persist_default");
    const res = await request(app)
      .post("/api/filaments")
      .set("Cookie", alice.cookie)
      .send({
        name: "Persist Spool",
        manufacturer: "DefaultSavedBrand",
        material: "DefaultSavedMat",
        colorName: "Black",
        colorCode: "#000000",
        totalWeight: 1000,
        remainingPercentage: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.manufacturer).toBe("DefaultSavedBrand");
    expect(res.body.material).toBe("DefaultSavedMat");

    const mfgRows = await db.select().from(manufacturers).where(eq(manufacturers.userId, alice.id));
    const mfgMatch = mfgRows.find((m) => m.name.toLowerCase() === "defaultsavedbrand");
    expect(mfgMatch).toBeDefined();

    const matRows = await ownRows(alice.id);
    const matMatch = matRows.find((m) => m.name.toLowerCase() === "defaultsavedmat");
    expect(matMatch).toBeDefined();
  });
});

