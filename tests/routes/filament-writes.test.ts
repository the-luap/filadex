/**
 * What a spool write may carry. The routes used to copy fields off the body
 * one by one, which kept ownership out of reach but let any value through.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerBatchRoutes } from "../../server/routes/batch";
import { registerFilamentRoutes } from "../../server/routes/filaments";
import { createApp, registerAndVerify } from "../helpers/app";

let app: Express;
let cookie: string;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

const spool = {
  name: "Orange PETG",
  manufacturer: "Prusament",
  material: "PETG",
  colorName: "Orange",
  colorCode: "#EA580C",
  diameter: 1.75,
  totalWeight: 1000,
  remainingPercentage: "100",
  status: "sealed",
  spoolType: "spooled",
};

beforeEach(async () => {
  // Batch before filaments, as registerRoutes does, or /batch matches /:id.
  app = createApp(registerAuthRoutes, registerBatchRoutes, registerFilamentRoutes);
  cookie = await registerAndVerify(app, alice);
});

async function create(body: Record<string, unknown> = spool) {
  return request(app).post("/api/filaments").set("Cookie", cookie).send(body);
}

describe("POST /api/filaments", () => {
  it("accepts numbers as numbers or strings and stores them as text", async () => {
    const res = await create();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ totalWeight: "1000", remainingPercentage: "100", diameter: "1.75", status: "sealed" });
  });

  it("accepts and returns barcode on creation and patch", async () => {
    const res = await create({ ...spool, barcode: "6975337031901" });
    expect(res.status).toBe(201);
    expect(res.body.barcode).toBe("6975337031901");

    const patchRes = await request(app)
      .patch(`/api/filaments/${res.body.id}`)
      .set("Cookie", cookie)
      .send({ barcode: "123456789012" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.barcode).toBe("123456789012");
  });

  it("refuses a status outside the known set", async () => {
    const res = await create({ ...spool, status: "bogus" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/status/);
  });

  it("refuses a purchase date that is not a date", async () => {
    const res = await create({ ...spool, purchaseDate: "yesterday" });

    expect(res.status).toBe(400);
  });

  it("refuses a percentage above 100 and a negative weight", async () => {
    expect((await create({ ...spool, remainingPercentage: 150 })).status).toBe(400);
    expect((await create({ ...spool, totalWeight: -1 })).status).toBe(400);
  });

  it("refuses custom-field values that are not a map of scalars", async () => {
    expect((await create({ ...spool, customFieldValues: "not-an-object" })).status).toBe(400);
    expect((await create({ ...spool, customFieldValues: { "1": { nested: true } } })).status).toBe(400);
    expect((await create({ ...spool, customFieldValues: { "1": "shelf B", "2": 3, "3": true } })).status).toBe(201);
  });

  it("answers 400, not 500, when the required fields are missing", async () => {
    const res = await create({ name: "x" });

    expect(res.status).toBe(400);
  });

  it("caps an import at 2000 rows", async () => {
    // Minimal rows, so the cap is what answers and not the body-size limit.
    const csvData = ["name,manufacturer,material", ...Array.from({ length: 2001 }, (_, i) => `s${i},m,PLA`)].join("\n");
    const res = await request(app)
      .post("/api/filaments?import=csv")
      .set("Cookie", cookie)
      .send({ csvData });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Import at most 2000 rows at a time");
  });

  it("persists barcodes across CSV export, CSV import, and JSON import", async () => {
    // 1. Create a spool with a barcode
    const created = await create({
      ...spool,
      name: "Barcode Spool",
      barcode: "6975337031901",
    });
    expect(created.status).toBe(201);
    expect(created.body.barcode).toBe("6975337031901");

    // 2. Test CSV export includes barcode column and value
    const csvExport = await request(app)
      .get("/api/filaments?export=csv")
      .set("Cookie", cookie);
    expect(csvExport.status).toBe(200);
    expect(csvExport.text).toContain("barcode");
    expect(csvExport.text).toContain("6975337031901");

    // 3. Test CSV import persists barcode
    const csvImportData = [
      "name,manufacturer,material,colorname,colorcode,diameter,printtemp,totalweight,remainingpercentage,purchasedate,purchaseprice,status,spooltype,dryercount,lastdryingdate,storagelocation,barcode",
      "Imported CSV Spool,Bambu Lab,PLA,White,#FFFFFF,1.75,210,1,100,2026-01-01,20,sealed,spooled,0,,Box A,6975337039999",
    ].join("\n");
    const csvImportRes = await request(app)
      .post("/api/filaments?import=csv")
      .set("Cookie", cookie)
      .send({ csvData: csvImportData });
    expect(csvImportRes.status).toBe(201);
    expect(csvImportRes.body.created).toBe(1);

    // Verify imported CSV spool has barcode
    const listAfterCsv = await request(app).get("/api/filaments").set("Cookie", cookie);
    const csvSpool = listAfterCsv.body.find((f: any) => f.name === "Imported CSV Spool");
    expect(csvSpool).toBeDefined();
    expect(csvSpool.barcode).toBe("6975337039999");

    // 4. Test JSON import persists barcode
    const jsonImportData = JSON.stringify([
      {
        name: "Imported JSON Spool",
        manufacturer: "Polymaker",
        material: "PETG",
        colorName: "Teal",
        colorCode: "#008080",
        barcode: "1234567890123",
      },
    ]);
    const jsonImportRes = await request(app)
      .post("/api/filaments?import=json")
      .set("Cookie", cookie)
      .send({ jsonData: jsonImportData });
    expect(jsonImportRes.status).toBe(201);
    expect(jsonImportRes.body.created).toBe(1);

    // Verify imported JSON spool has barcode
    const listAfterJson = await request(app).get("/api/filaments").set("Cookie", cookie);
    const jsonSpool = listAfterJson.body.find((f: any) => f.name === "Imported JSON Spool");
    expect(jsonSpool).toBeDefined();
    expect(jsonSpool.barcode).toBe("1234567890123");
  });
});

describe("PATCH /api/filaments/:id and /batch", () => {
  it("validates a patch the same way", async () => {
    const { body: created } = await create();

    const bad = await request(app).patch(`/api/filaments/${created.id}`).set("Cookie", cookie).send({ spoolType: "cardboard" });
    expect(bad.status).toBe(400);

    const good = await request(app).patch(`/api/filaments/${created.id}`).set("Cookie", cookie).send({ remainingPercentage: 40, note: "used some" });
    expect(good.status).toBe(200);
    expect(good.body.remainingPercentage).toBe("40");
  });

  it("validates a batch update the same way", async () => {
    const { body: created } = await create();

    const bad = await request(app).patch("/api/filaments/batch").set("Cookie", cookie).send({ ids: [created.id], updates: { status: "bogus" } });
    expect(bad.status).toBe(400);

    const good = await request(app).patch("/api/filaments/batch").set("Cookie", cookie).send({ ids: [created.id], updates: { storageLocation: "Shelf B" } });
    expect(good.status).toBe(200);
    expect(good.body.updatedCount).toBe(1);
  });
});

