/**
 * Characterisation tests for server/routes/community-filaments.ts and the
 * SpoolmanDB sync behind it (server/utils/spoolmandb-sync.ts).
 *
 * These record observable behaviour, so that moving the database access behind
 * IStorage can be shown to change nothing. The refresh path is worth pinning
 * carefully: it is the only TRUNCATE and the only explicit transaction in the
 * application, and the search is the only ILIKE.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerCommunityFilamentRoutes } from "../../server/routes/community-filaments";
import {
  refreshCommunityFilamentCache,
  searchCommunityFilaments,
} from "../../server/utils/spoolmandb-sync";
import { db } from "../helpers/db";
import { communityFilamentCache } from "../../shared/schema";
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
    // Mock credentials for a throwaway test database - not a real login anywhere, so
    // the password below is safe to keep in the repository (hence the ggignore tag).
    password: "correct-horse", // ggignore
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seedCache(rows: Array<Record<string, unknown>>) {
  await db.insert(communityFilamentCache).values(rows as never);
}

const bambu = {
  manufacturer: "Bambu Lab",
  material: "PLA",
  name: "Basic PLA Jade White",
  colorName: "Jade White",
  colorCode: "#FFFFFF",
};
const prusa = {
  manufacturer: "Prusament",
  material: "PETG",
  name: "Prusament PETG Orange",
  colorName: "Orange",
};

describe("searchCommunityFilaments", () => {
  beforeEach(() => seedCache([bambu, prusa]));

  it("matches on the manufacturer", async () => {
    const results = await searchCommunityFilaments("Bambu");

    expect(results.map((r) => r.name)).toEqual(["Basic PLA Jade White"]);
  });

  it("matches on the product name", async () => {
    const results = await searchCommunityFilaments("Prusament PETG");

    expect(results.map((r) => r.name)).toEqual(["Prusament PETG Orange"]);
  });

  it("matches on the colour name", async () => {
    const results = await searchCommunityFilaments("orange");

    expect(results.map((r) => r.name)).toEqual(["Prusament PETG Orange"]);
  });

  it("ignores case", async () => {
    const results = await searchCommunityFilaments("JADE");

    expect(results.map((r) => r.name)).toEqual(["Basic PLA Jade White"]);
  });

  it("matches anywhere in the value, not just the start", async () => {
    const results = await searchCommunityFilaments("ade Whi");

    expect(results.map((r) => r.name)).toEqual(["Basic PLA Jade White"]);
  });

  it("returns nothing when there is no match", async () => {
    expect(await searchCommunityFilaments("nothing-like-this")).toEqual([]);
  });

  // The wildcards are escaped rather than stripped, so a query made only of
  // them matches literally - nothing here contains a `%` or `_`.
  it("treats a query of only SQL wildcards as literal text", async () => {
    expect(await searchCommunityFilaments("%")).toEqual([]);
    expect(await searchCommunityFilaments("_")).toEqual([]);
    expect(await searchCommunityFilaments("%_%")).toEqual([]);
  });

  it("finds a manufacturer that literally contains a wildcard character", async () => {
    await seedCache([
      { manufacturer: "50% Off Filament", material: "PLA", name: "Cheap PLA", colorName: "Grey" },
      { manufacturer: "under_score Co", material: "PLA", name: "Plain PLA", colorName: "Grey" },
    ]);

    expect((await searchCommunityFilaments("50%")).map((r) => r.name)).toEqual(["Cheap PLA"]);
    expect((await searchCommunityFilaments("under_score")).map((r) => r.name)).toEqual(["Plain PLA"]);
  });

  it("caps how many rows it returns", async () => {
    await seedCache(
      Array.from({ length: 30 }, (_, i) => ({
        manufacturer: "Filler",
        material: "PLA",
        name: `Filler ${i}`,
        colorName: "Black",
      })),
    );

    expect(await searchCommunityFilaments("Filler")).toHaveLength(20);
    expect(await searchCommunityFilaments("Filler", 5)).toHaveLength(5);
  });
});

describe("refreshCommunityFilamentCache", () => {
  /** Stands in for the SpoolmanDB repo on GitHub, which the sync fetches over HTTP. */
  function stubSpoolmanDb(vendorFiles: Record<string, unknown>) {
    const tree = Object.keys(vendorFiles).map((path) => ({ path, type: "blob" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.github.com")) {
          return { ok: true, json: async () => ({ tree }) };
        }
        const path = Object.keys(vendorFiles).find((p) => url.endsWith(p));
        if (!path) return { ok: false, status: 404, statusText: "Not Found" };
        return { ok: true, json: async () => vendorFiles[path] };
      }),
    );
  }

  it("stores one row per colour of each filament", async () => {
    stubSpoolmanDb({
      "filaments/bambu.json": {
        manufacturer: "Bambu Lab",
        filaments: [
          {
            name: "Basic PLA {color_name}",
            material: "PLA",
            density: 1.24,
            diameters: [1.75, 2.85],
            extruder_temp: 220,
            bed_temp: 60,
            colors: [
              { name: "Jade White", hex: "FFFFFF" },
              { name: "Black", hex: "#000000" },
            ],
          },
        ],
      },
    });

    const count = await refreshCommunityFilamentCache();

    expect(count).toBe(2);
    const stored = await db.select().from(communityFilamentCache);
    expect(stored.map((r) => r.name).sort()).toEqual(["Basic PLA Black", "Basic PLA Jade White"]);
    expect(stored.find((r) => r.colorName === "Jade White")).toMatchObject({
      manufacturer: "Bambu Lab",
      material: "PLA",
      // numeric columns come back as strings; only the first diameter is kept
      density: "1.24",
      diameter: "1.75",
      extruderTemp: 220,
      bedTemp: 60,
      colorCode: "#FFFFFF",
    });
  });

  it("normalises a colour code that already has its hash", async () => {
    stubSpoolmanDb({
      "filaments/x.json": {
        manufacturer: "X",
        filaments: [{ name: "N", material: "PLA", colors: [{ name: "Black", hex: "#000000" }] }],
      },
    });

    await refreshCommunityFilamentCache();

    const [stored] = await db.select().from(communityFilamentCache);
    expect(stored.colorCode).toBe("#000000");
  });

  it("gives a filament with no colours a single Unknown entry", async () => {
    stubSpoolmanDb({
      "filaments/x.json": {
        manufacturer: "X",
        filaments: [{ name: "Plain", material: "PLA" }],
      },
    });

    const count = await refreshCommunityFilamentCache();

    expect(count).toBe(1);
    const [stored] = await db.select().from(communityFilamentCache);
    expect(stored).toMatchObject({ name: "Plain", colorName: "Unknown", colorCode: null });
  });

  // The refresh empties the table before reloading, so rows that have
  // disappeared upstream do not linger.
  it("replaces what was cached before rather than adding to it", async () => {
    await seedCache([{ ...bambu, name: "Withdrawn Product" }]);
    stubSpoolmanDb({
      "filaments/x.json": {
        manufacturer: "X",
        filaments: [{ name: "Current Product", material: "PLA", colors: [{ name: "Black", hex: "000000" }] }],
      },
    });

    await refreshCommunityFilamentCache();

    const stored = await db.select().from(communityFilamentCache);
    expect(stored.map((r) => r.name)).toEqual(["Current Product"]);
  });

  it("empties the cache when the upstream repo has nothing", async () => {
    await seedCache([bambu]);
    stubSpoolmanDb({});

    const count = await refreshCommunityFilamentCache();

    expect(count).toBe(0);
    expect(await db.select().from(communityFilamentCache)).toEqual([]);
  });

  // Rows are inserted 500 at a time to stay under the driver's parameter limit.
  it("stores more rows than fit in a single insert", async () => {
    stubSpoolmanDb({
      "filaments/big.json": {
        manufacturer: "Bulk",
        filaments: [
          {
            name: "Bulk {color_name}",
            material: "PLA",
            colors: Array.from({ length: 1200 }, (_, i) => ({ name: `Color ${i}`, hex: "000000" })),
          },
        ],
      },
    });

    const count = await refreshCommunityFilamentCache();

    expect(count).toBe(1200);
    const stored = await db.select().from(communityFilamentCache);
    expect(stored).toHaveLength(1200);
  });

  it("skips a vendor file it cannot fetch, keeping the rest", async () => {
    const tree = [
      { path: "filaments/good.json", type: "blob" },
      { path: "filaments/missing.json", type: "blob" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.github.com")) return { ok: true, json: async () => ({ tree }) };
        if (url.endsWith("good.json")) {
          return {
            ok: true,
            json: async () => ({
              manufacturer: "Good",
              filaments: [{ name: "Fine", material: "PLA", colors: [{ name: "Black", hex: "000000" }] }],
            }),
          };
        }
        return { ok: false, status: 404, statusText: "Not Found" };
      }),
    );

    const count = await refreshCommunityFilamentCache();

    expect(count).toBe(1);
  });

  it("fails, leaving the cache alone, when the repo listing cannot be read", async () => {
    await seedCache([bambu]);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, statusText: "Service Unavailable" })));

    await expect(refreshCommunityFilamentCache()).rejects.toThrow(
      "Failed to list SpoolmanDB tree: 503 Service Unavailable",
    );
    expect(await db.select().from(communityFilamentCache)).toHaveLength(1);
  });

  it("only considers json files under filaments/", async () => {
    const tree = [
      { path: "filaments/good.json", type: "blob" },
      { path: "filaments/notes.md", type: "blob" },
      { path: "README.md", type: "blob" },
      { path: "filaments", type: "tree" },
    ];
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("api.github.com")) return { ok: true, json: async () => ({ tree }) };
      return {
        ok: true,
        json: async () => ({
          manufacturer: "Good",
          filaments: [{ name: "Fine", material: "PLA", colors: [{ name: "Black", hex: "000000" }] }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await refreshCommunityFilamentCache();

    const fetched = fetchMock.mock.calls.map(([url]) => url as string).filter((url) => !url.includes("api.github.com"));
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toContain("filaments/good.json");
  });
});

describe("GET /api/community-filaments/search", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).get("/api/community-filaments/search").query({ q: "bambu" });

    expect(response.status).toBe(401);
  });

  it("returns matches for any signed-in user", async () => {
    await seedCache([bambu, prusa]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "bambu" })
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body.map((r: { name: string }) => r.name)).toEqual(["Basic PLA Jade White"]);
  });

  it.each([
    ["a missing query", undefined],
    ["an empty query", ""],
    ["a query of only spaces", "   "],
  ])("answers with nothing for %s", async (_label, q) => {
    await seedCache([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query(q === undefined ? {} : { q })
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", async () => {
    await seedCache([bambu]);

    const response = await request(app)
      .get("/api/community-filaments/search")
      .query({ q: "  bambu  " })
      .set("Cookie", userCookie);

    expect(response.body).toHaveLength(1);
  });
});

describe("GET /api/community-filaments/status", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).get("/api/community-filaments/status").set("Cookie", userCookie);

    expect(response.status).toBe(403);
  });

  it("reports an empty cache", async () => {
    const response = await request(app).get("/api/community-filaments/status").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 0, lastUpdated: null });
  });

  it("reports how much is cached and when it was last written", async () => {
    await seedCache([bambu, prusa]);

    const response = await request(app).get("/api/community-filaments/status").set("Cookie", adminCookie);

    expect(response.body.count).toBe(2);
    // max() over a timestamp column arrives as a raw Postgres string rather
    // than the ISO form drizzle produces for a plain timestamp select.
    expect(response.body.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});

describe("POST /api/community-filaments/refresh", () => {
  it("rejects a non-admin", async () => {
    const response = await request(app).post("/api/community-filaments/refresh").set("Cookie", userCookie);

    expect(response.status).toBe(403);
  });

  it("answers with the number of rows it cached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.github.com")) {
          return { ok: true, json: async () => ({ tree: [{ path: "filaments/x.json", type: "blob" }] }) };
        }
        return {
          ok: true,
          json: async () => ({
            manufacturer: "X",
            filaments: [{ name: "N", material: "PLA", colors: [{ name: "Black", hex: "000000" }] }],
          }),
        };
      }),
    );

    const response = await request(app).post("/api/community-filaments/refresh").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 1 });
  });

  it("answers 500 when the upstream repo cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, statusText: "Service Unavailable" })));

    const response = await request(app).post("/api/community-filaments/refresh").set("Cookie", adminCookie);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Failed to refresh community filament cache");
  });
});
