import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerCommunityFilamentRoutes } from "../../server/routes/community-filaments";
import { communityCatalog, type CommunityCatalogItem } from "../../server/services/community-catalog";
import { createApp, loginAs, registerAndVerify, bootstrapAdmin } from "../helpers/app";

let app: Express;
let adminCookie: string;
let userCookie: string;

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerCommunityFilamentRoutes);
  await bootstrapAdmin();
  adminCookie = await loginAs(app, "admin", "admin");
  userCookie = await registerAndVerify(app, {
    username: "alice",
    email: "alice@example.com",
    password: "correct-horse",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bambu: CommunityCatalogItem = {
  id: "bambu-1",
  source: "ofd",
  manufacturer: "Bambu Lab",
  material: "PLA",
  name: "Basic PLA Jade White",
  colorName: "Jade White",
  colorCode: "#FFFFFF",
  density: 1.24,
  diameter: 1.75,
  weightGrams: 1000,
  spoolRefill: false,
  extruderTemp: 220,
  bedTemp: 55,
  gtin: "6975337031901",
};

const prusa: CommunityCatalogItem = {
  id: "prusa-1",
  source: "spoolmandb",
  manufacturer: "Prusament",
  material: "PETG",
  name: "Prusament PETG Orange",
  colorName: "Orange",
  colorCode: "#FF8800",
  density: 1.27,
  diameter: 1.75,
  weightGrams: 1000,
  spoolRefill: false,
  extruderTemp: 250,
  bedTemp: 80,
  gtin: null,
};

describe("GET /api/community-filaments/search", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).get("/api/community-filaments/search").query({ q: "bambu" });
    expect(response.status).toBe(401);
  });

  it("returns matches for any signed-in user", async () => {
    communityCatalog.setItems([bambu, prusa]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "bambu" })
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body.map((r: { name: string }) => r.name)).toEqual(["Basic PLA Jade White"]);
  });

  it("filters by source when source query parameter is provided", async () => {
    communityCatalog.setItems([bambu, prusa]);

    const ofdResponse = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "bambu", source: "ofd" })
      .set("Cookie", userCookie);

    expect(ofdResponse.status).toBe(200);
    expect(ofdResponse.body).toHaveLength(1);

    const spoolmanResponse = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "bambu", source: "spoolmandb" })
      .set("Cookie", userCookie);

    expect(spoolmanResponse.status).toBe(200);
    expect(spoolmanResponse.body).toHaveLength(0);
  });

  it.each([
    ["a missing query", undefined],
    ["an empty query", ""],
    ["a query of only spaces", "   "],
  ])("answers with nothing for %s", async (_label, q) => {
    communityCatalog.setItems([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query(q === undefined ? {} : { q })
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", async () => {
    communityCatalog.setItems([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "  bambu  " })
      .set("Cookie", userCookie);

    expect(response.body).toHaveLength(1);
  });
});

describe("GET /api/community-filaments/gtin/:code", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/community-filaments/gtin/6975337031901");
    expect(response.status).toBe(401);
  });

  it("returns the catalog item if GTIN is found", async () => {
    communityCatalog.setItems([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/gtin/6975337031901")
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body.gtin).toBe("6975337031901");
    expect(response.body.name).toBe("Basic PLA Jade White");
  });

  it("returns 404 if GTIN is not found", async () => {
    communityCatalog.setItems([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/gtin/9999999999999")
      .set("Cookie", userCookie);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/community-filaments/status", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).get("/api/community-filaments/status").set("Cookie", userCookie);
    expect(response.status).toBe(403);
  });

  it("reports catalog status for OFD and SpoolmanDB", async () => {
    communityCatalog.setItems([]);
    communityCatalog.setStatus("ofd", { count: 10, lastUpdated: "2026-09-08T00:00:00Z" });
    communityCatalog.setStatus("spoolmandb", { count: 5, lastUpdated: "2026-09-07T00:00:00Z" });

    const response = await request(app).get("/api/community-filaments/status").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.ofd).toEqual({ count: 10, lastUpdated: "2026-09-08T00:00:00Z" });
    expect(response.body.spoolmandb).toEqual({ count: 5, lastUpdated: "2026-09-07T00:00:00Z" });
    expect(response.body.count).toBe(15);
  });
});

describe("POST /api/community-filaments/refresh", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).post("/api/community-filaments/refresh").set("Cookie", userCookie);
    expect(response.status).toBe(403);
  });

  it("refreshes ofd when source is ofd", async () => {
    const syncSpy = vi.spyOn(communityCatalog, "sync").mockResolvedValue({ ofdCount: 100, spoolmanCount: 0 });

    const response = await request(app)
      .post("/api/community-filaments/refresh")
      .send({ source: "ofd" })
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(syncSpy).toHaveBeenCalledWith("ofd");
    expect(response.body).toEqual({ ofdCount: 100, spoolmanCount: 0, count: 100 });
  });

  it("refreshes both when source is all or omitted", async () => {
    const syncSpy = vi.spyOn(communityCatalog, "sync").mockResolvedValue({ ofdCount: 100, spoolmanCount: 50 });

    const response = await request(app)
      .post("/api/community-filaments/refresh")
      .send({})
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(syncSpy).toHaveBeenCalledWith("all");
    expect(response.body).toEqual({ ofdCount: 100, spoolmanCount: 50, count: 150 });
  });

  it("returns 409 Conflict if catalog synchronization is already in progress", async () => {
    vi.spyOn(communityCatalog, "isSyncing").mockReturnValue(true);

    const response = await request(app)
      .post("/api/community-filaments/refresh")
      .send({})
      .set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already in progress/i);
  });

  it("rejects an invalid source parameter with 400 Bad Request", async () => {
    const response = await request(app)
      .post("/api/community-filaments/refresh")
      .send({ source: "invalid_source" })
      .set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid source/i);
  });
});

