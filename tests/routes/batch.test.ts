/**
 * What one batch request may cost.
 *
 * The ids array used to be forwarded as the caller sent it, duplicates and all,
 * and every occurrence ran its own SELECT, UPDATE and SELECT - so a 20 KB body
 * naming one owned spool ten thousand times bought ten thousand round trips
 * against the shared database.
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerBatchRoutes } from "../../server/routes/batch";
import { registerFilamentRoutes } from "../../server/routes/filaments";
import { MAX_BATCH_IDS } from "../../server/utils/batch-operations";
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

async function createSpool(): Promise<number> {
  const res = await request(app).post("/api/filaments").set("Cookie", cookie).send(spool);
  expect(res.status).toBe(201);
  return res.body.id;
}

describe("PATCH /api/filaments/batch", () => {
  it("applies a repeated id once", async () => {
    const id = await createSpool();

    const res = await request(app)
      .patch("/api/filaments/batch")
      .set("Cookie", cookie)
      .send({ ids: [id, id, id, id, id], updates: { status: "opened" } });

    expect(res.status).toBe(200);
    // One spool was updated, not five: the count is the number of database
    // round trips the duplicates used to buy.
    expect(res.body.updatedCount).toBe(1);

    const after = await request(app).get(`/api/filaments/${id}`).set("Cookie", cookie);
    expect(after.body.status).toBe("opened");
  });

  it("refuses an array longer than the batch limit before touching the database", async () => {
    const id = await createSpool();
    const ids = new Array(MAX_BATCH_IDS + 1).fill(id);

    const res = await request(app)
      .patch("/api/filaments/batch")
      .set("Cookie", cookie)
      .send({ ids, updates: { status: "opened" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most/i);

    const after = await request(app).get(`/api/filaments/${id}`).set("Cookie", cookie);
    expect(after.body.status).toBe("sealed");
  });
});

describe("DELETE /api/filaments/batch", () => {
  it("counts a repeated id once", async () => {
    const id = await createSpool();

    const res = await request(app)
      .delete("/api/filaments/batch")
      .set("Cookie", cookie)
      .send({ ids: [id, id, id] });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(1);
  });

  it("refuses an array longer than the batch limit", async () => {
    const id = await createSpool();

    const res = await request(app)
      .delete("/api/filaments/batch")
      .set("Cookie", cookie)
      .send({ ids: new Array(MAX_BATCH_IDS + 1).fill(id) });

    expect(res.status).toBe(400);
    await request(app).get(`/api/filaments/${id}`).set("Cookie", cookie).expect(200);
  });
});
