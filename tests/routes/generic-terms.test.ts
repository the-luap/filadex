import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { genericTerms } from "../../shared/schema";
import { db, dialect } from "../helpers/db";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerSettingsRoutes } from "../../server/routes/settings";
import { storage } from "../../server/storage";
import { createApp, loginAs, registerAndVerify, bootstrapAdmin } from "../helpers/app";

let app: Express;
let adminCookie: string;

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

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerSettingsRoutes);
  await bootstrapAdmin();
  adminCookie = await loginAs(app, "admin", "admin");
});

describe("GET /api/generic-terms", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/generic-terms");
    expect(res.status).toBe(401);
  });

  it("returns generic terms for authenticated users", async () => {
    const alice = await newUser("alice");
    const res = await request(app).get("/api/generic-terms").set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns generic terms in alphabetical order by word", async () => {
    await storage.createGenericTerm({ word: "zebra" });
    await storage.createGenericTerm({ word: "alpha" });
    await storage.createGenericTerm({ word: "middle" });

    const res = await request(app).get("/api/generic-terms").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    const words = res.body.map((t: { word: string }) => t.word);
    expect(words).toEqual(["alpha", "middle", "zebra"]);
  });

  it("exports generic terms as CSV", async () => {
    await storage.createGenericTerm({ word: "pla" });
    await storage.createGenericTerm({ word: "filament" });

    const res = await request(app)
      .get("/api/generic-terms?export=csv")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("word\n");
    expect(res.text).toContain("filament\n");
    expect(res.text).toContain("pla\n");
  });
});

describe("POST /api/generic-terms", () => {
  it("refuses a non-admin creating a generic term with 403", async () => {
    const alice = await newUser("alice_poster");
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", alice.cookie)
      .send({ word: "forbidden" });

    expect(res.status).toBe(403);
    const terms = await storage.getGenericTerms();
    expect(terms).toHaveLength(0);
  });

  it("creates a generic term as admin", async () => {
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "testword" });

    expect(res.status).toBe(201);
    expect(res.body.word).toBe("testword");
    expect(res.body.id).toBeDefined();

    const terms = await storage.getGenericTerms();
    expect(terms).toHaveLength(1);
    expect(terms[0].word).toBe("testword");
  });

  it("lowercases the word on creation", async () => {
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "TestWord" });

    expect(res.status).toBe(201);
    expect(res.body.word).toBe("testword");

    const terms = await storage.getGenericTerms();
    expect(terms[0].word).toBe("testword");
  });

  it("trims whitespace around the word on creation", async () => {
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "  padded  " });

    expect(res.status).toBe(201);
    expect(res.body.word).toBe("padded");

    const terms = await storage.getGenericTerms();
    expect(terms[0].word).toBe("padded");
  });

  it("answers 409 when creating a duplicate term", async () => {
    await storage.createGenericTerm({ word: "duplicate" });

    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "duplicate" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("answers 409 when creating a duplicate term with different case or whitespace", async () => {
    await storage.createGenericTerm({ word: "duplicate" });

    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "  Duplicate  " });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects missing word with 400", async () => {
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejects whitespace-only word with 400", async () => {
    const res = await request(app)
      .post("/api/generic-terms")
      .set("Cookie", adminCookie)
      .send({ word: "   " });

    expect(res.status).toBe(400);
  });

  it("imports generic terms via CSV", async () => {
    const csvData = "word\nterm1\nterm2\n";
    const res = await request(app)
      .post("/api/generic-terms?import=csv")
      .set("Cookie", adminCookie)
      .send({ csvData });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    expect(res.body.duplicates).toBe(0);
    expect(res.body.errors).toBe(0);

    const terms = await storage.getGenericTerms();
    expect(terms.map((t) => t.word)).toEqual(["term1", "term2"]);
  });
});

describe("DELETE /api/generic-terms/:id", () => {
  it("refuses a non-admin deleting a generic term with 403", async () => {
    const term = await storage.createGenericTerm({ word: "nodelete" });
    const alice = await newUser("alice_deleter");

    const res = await request(app)
      .delete(`/api/generic-terms/${term.id}`)
      .set("Cookie", alice.cookie);

    expect(res.status).toBe(403);
    const terms = await storage.getGenericTerms();
    expect(terms).toHaveLength(1);
  });

  it("lets an admin delete a generic term with 204", async () => {
    const term = await storage.createGenericTerm({ word: "todelete" });

    const res = await request(app)
      .delete(`/api/generic-terms/${term.id}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(204);
    const terms = await storage.getGenericTerms();
    expect(terms).toHaveLength(0);
  });

  it("returns 404 for non-existent generic term", async () => {
    const res = await request(app)
      .delete("/api/generic-terms/99999")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid generic term ID", async () => {
    const res = await request(app)
      .delete("/api/generic-terms/abc")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(400);
  });
});

describe("generic terms sequence guard (ADR-0009)", () => {
  it("detects when generic terms were previously populated even if all rows are deleted", async () => {
    // 1. Initially after reset, table is empty and maxId is 0
    const [{ initialMax }] = await db
      .select({ initialMax: sql<number>`coalesce(max(${genericTerms.id}), 0)` })
      .from(genericTerms);
    expect(Number(initialMax)).toBe(0);

    // 2. Populate a term
    await storage.createGenericTerm({ word: "temporary" });

    // 3. Admin deletes the term (surviving rows count is now 0)
    const terms = await storage.getGenericTerms();
    for (const term of terms) {
      await storage.deleteGenericTerm(term.id);
    }

    const [{ survivingMax }] = await db
      .select({ survivingMax: sql<number>`coalesce(max(${genericTerms.id}), 0)` })
      .from(genericTerms);
    expect(Number(survivingMax)).toBe(0);

    // 4. Sequence generator inspection detects it was previously seeded
    let sequenceSeeded = false;
    if ((dialect as string) === "sqlite") {
      const rows: any = await (db as any).all(
        sql`SELECT seq FROM sqlite_sequence WHERE name = 'generic_terms'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const seq = rows[0]?.seq;
        if (Number(seq) > 0) sequenceSeeded = true;
      }
    } else {
      const result: any = await (db as any).execute(
        sql`SELECT last_value, is_called FROM generic_terms_id_seq`
      );
      const rows = result?.rows ?? (Array.isArray(result) ? result : []);
      if (rows.length > 0) {
        const isCalled = rows[0]?.is_called ?? (Array.isArray(rows[0]) ? rows[0][1] : undefined);
        if (isCalled) sequenceSeeded = true;
      }
    }

    expect(sequenceSeeded).toBe(true);
  });
});
