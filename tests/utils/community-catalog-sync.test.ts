import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import os from "os";
import {
  CommunityCatalogService,
  type OfdDataset,
  type SpoolmanDbVendorFile,
} from "../../server/services/community-catalog";

describe("CommunityCatalogService sync", () => {
  let tempDir: string;
  let service: CommunityCatalogService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-test-"));
    service = new CommunityCatalogService(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("syncOfd fetches gzipped all.json, unzips, caches to disk, and updates memory index", async () => {
    const mockOfd: OfdDataset = {
      version: "2026.09.08",
      generated_at: "2026-09-08T00:00:00Z",
      brands: [{ id: "b1", name: "Bambu Lab", slug: "bambu_lab" }],
      filaments: [{ id: "f1", brand_id: "b1", name: "PLA Basic", material: "PLA" }],
      variants: [{ id: "v1", filament_id: "f1", name: "Jade White", color_hex: "#FFFFFF" }],
      sizes: [{ id: "s1", variant_id: "v1", diameter: 1.75, filament_weight: 1000, gtin: "6975337031901" }],
    };
    const gzipped = zlib.gzipSync(Buffer.from(JSON.stringify(mockOfd)));

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("all.json.gz")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => gzipped.buffer.slice(gzipped.byteOffset, gzipped.byteOffset + gzipped.byteLength),
        } as any;
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const count = await service.syncOfd();
    expect(count).toBe(1);

    const found = service.lookupGtin("6975337031901");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("PLA Basic");

    // Check disk cache was written
    expect(fs.existsSync(path.join(tempDir, "ofd.json"))).toBe(true);

    // Verify loading fresh from disk
    const freshService = new CommunityCatalogService(tempDir);
    await freshService.loadFromDisk();
    expect(freshService.lookupGtin("6975337031901")?.name).toBe("PLA Basic");
  });

  it("syncSpoolmanDb fetches tree and files, caches to disk, and updates memory index", async () => {
    const mockVendor: SpoolmanDbVendorFile = {
      manufacturer: "Prusa",
      filaments: [
        {
          name: "Prusament PLA {color_name}",
          material: "PLA",
          diameters: [1.75],
          colors: [{ name: "Galaxy Black", hex: "111111" }],
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("git/trees/main")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tree: [{ path: "filaments/prusa.json", type: "blob" }],
          }),
        } as any;
      }
      if (urlStr.includes("filaments/prusa.json")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockVendor),
        } as any;
      }
      throw new Error(`Unexpected url: ${urlStr}`);
    });

    const count = await service.syncSpoolmanDb();
    expect(count).toBe(1);

    const search = service.search("galaxy");
    expect(search.length).toBe(1);
    expect(search[0].manufacturer).toBe("Prusa");

    // Verify disk cache
    expect(fs.existsSync(path.join(tempDir, "spoolmandb.json"))).toBe(true);
  });

  it("prevents concurrent sync operations using mutex guard", async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(global, "fetch").mockImplementation(() => fetchPromise as any);

    expect(service.isSyncing()).toBe(false);
    const syncPromise1 = service.syncOfd();
    expect(service.isSyncing()).toBe(true);

    // Second sync should fail immediately with an error
    await expect(service.syncOfd()).rejects.toThrow(/already in progress/i);
    await expect(service.syncSpoolmanDb()).rejects.toThrow(/already in progress/i);
    await expect(service.sync()).rejects.toThrow(/already in progress/i);

    // Resolve first fetch
    const mockOfd: OfdDataset = {
      version: "1",
      generated_at: "2026-09-08T00:00:00Z",
      brands: [],
      filaments: [],
      variants: [],
      sizes: [],
    };
    const gzipped = zlib.gzipSync(Buffer.from(JSON.stringify(mockOfd)));
    resolveFetch!({
      ok: true,
      status: 200,
      arrayBuffer: async () => gzipped.buffer.slice(gzipped.byteOffset, gzipped.byteOffset + gzipped.byteLength),
    });

    await syncPromise1;
    expect(service.isSyncing()).toBe(false);
  });

  it("sync('all') allows one source to succeed if the other fails", async () => {
    const mockVendor: SpoolmanDbVendorFile = {
      manufacturer: "Prusa",
      filaments: [
        {
          name: "Prusament PLA {color_name}",
          material: "PLA",
          diameters: [1.75],
          colors: [{ name: "Galaxy Black", hex: "111111" }],
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("all.json.gz")) {
        throw new Error("OFD network outage");
      }
      if (urlStr.includes("git/trees/main")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tree: [{ path: "filaments/prusa.json", type: "blob" }],
          }),
        } as any;
      }
      if (urlStr.includes("filaments/prusa.json")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockVendor),
        } as any;
      }
      throw new Error(`Unexpected url: ${urlStr}`);
    });

    const result = await service.sync("all");
    expect(result.ofdCount).toBe(0);
    expect(result.spoolmanCount).toBe(1);
    expect(service.getStatus().spoolmandb.count).toBe(1);
  });

  it("passes GITHUB_TOKEN in headers during SpoolmanDB sync when env var is set", async () => {
    process.env.GITHUB_TOKEN = "ghp_test123456";
    let capturedHeaders: any;

    vi.spyOn(global, "fetch").mockImplementation(async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes("git/trees/main")) {
        capturedHeaders = options?.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ tree: [] }),
        } as any;
      }
      throw new Error(`Unexpected url: ${urlStr}`);
    });

    try {
      await service.syncSpoolmanDb();
      expect(capturedHeaders?.Authorization).toBe("token ghp_test123456");
    } finally {
      delete process.env.GITHUB_TOKEN;
    }
  });
});


