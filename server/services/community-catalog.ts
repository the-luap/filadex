import fs from "fs";
import path from "path";
import zlib from "zlib";
import { logger } from "../utils/logger";
import type { CommunityCatalogItem } from "@shared/schema";

export type { CommunityCatalogItem };


export interface CatalogSourceStatus {
  count: number;
  lastUpdated: string | null;
}

export interface CommunityCatalogStatus {
  ofd: CatalogSourceStatus;
  spoolmandb: CatalogSourceStatus;
}

export interface OfdBrand {
  id: string;
  name: string;
  slug: string;
}

export interface OfdFilament {
  id: string;
  brand_id: string;
  name: string;
  material: string;
  density?: number;
  slicer_settings?: {
    [slicer: string]: {
      extruder_temp?: number;
      bed_temp?: number;
    };
  };
}

export interface OfdVariant {
  id: string;
  filament_id: string;
  name: string;
  color_hex?: string;
}

export interface OfdSize {
  id: string;
  variant_id: string;
  diameter?: number;
  filament_weight?: number;
  spool_refill?: boolean;
  gtin?: string;
}

export interface OfdDataset {
  version: string;
  generated_at: string;
  brands: OfdBrand[];
  filaments: OfdFilament[];
  variants: OfdVariant[];
  sizes: OfdSize[];
}

export interface SpoolmanDbColor {
  name: string;
  hex?: string;
}

export interface SpoolmanDbFilament {
  name: string;
  material: string;
  density?: number;
  diameters?: number[];
  extruder_temp?: number;
  bed_temp?: number;
  colors?: SpoolmanDbColor[];
}

export interface SpoolmanDbVendorFile {
  manufacturer: string;
  filaments: SpoolmanDbFilament[];
}

function normalizeGtin(gtin: string): string {
  return gtin.trim().replace(/^0+/, "");
}

export class CatalogSyncConflictError extends Error {
  constructor(message = "Catalog synchronization is already in progress") {
    super(message);
    this.name = "CatalogSyncConflictError";
  }
}

export function getCatalogCacheDir(): string {
  if (process.env.CATALOG_CACHE_DIR) {
    return path.resolve(process.env.CATALOG_CACHE_DIR);
  }
  if (process.env.NODE_ENV === "production") {
    return "/data/cache/catalogs";
  }
  return path.resolve(process.cwd(), "data", "cache", "catalogs");
}

export class CommunityCatalogService {
  private items: CommunityCatalogItem[] = [];
  private gtinMap: Map<string, CommunityCatalogItem> = new Map();
  private status: CommunityCatalogStatus = {
    ofd: { count: 0, lastUpdated: null },
    spoolmandb: { count: 0, lastUpdated: null },
  };
  private syncing = false;

  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || getCatalogCacheDir();
  }

  public isSyncing(): boolean {
    return this.syncing;
  }

  public setItems(items: CommunityCatalogItem[]): void {
    this.items = items;
    this.rebuildIndexes();
  }

  public setSourceItems(source: "ofd" | "spoolmandb", items: CommunityCatalogItem[], lastUpdated: string | null): void {
    const remaining = this.items.filter((item) => item.source !== source);
    this.items = [...remaining, ...items];
    this.status[source] = {
      count: items.length,
      lastUpdated,
    };
    this.rebuildIndexes();
  }

  private rebuildIndexes(): void {
    const nextGtinMap = new Map<string, CommunityCatalogItem>();
    for (const item of this.items) {
      if (item.gtin) {
        const raw = item.gtin.trim();
        const norm = normalizeGtin(raw);
        if (norm) {
          nextGtinMap.set(norm, item);
        } else if (raw) {
          nextGtinMap.set(raw, item);
        }
      }
    }
    this.gtinMap = nextGtinMap;
  }

  public search(
    query: string,
    options?: { source?: "ofd" | "spoolmandb"; limit?: number }
  ): CommunityCatalogItem[] {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const limit = options?.limit ?? 20;
    const source = options?.source;
    const results: CommunityCatalogItem[] = [];

    for (const item of this.items) {
      if (source && item.source !== source) {
        continue;
      }

      const haystack = `${item.manufacturer} ${item.name} ${item.colorName} ${item.material}`.toLowerCase();
      if (terms.every((term) => haystack.includes(term))) {
        results.push(item);
        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  public lookupGtin(gtin: string): CommunityCatalogItem | null {
    if (!gtin || !gtin.trim()) {
      return null;
    }
    const raw = gtin.trim();
    const norm = normalizeGtin(raw);
    if (norm && this.gtinMap.has(norm)) {
      return this.gtinMap.get(norm)!;
    }
    if (this.gtinMap.has(raw)) {
      return this.gtinMap.get(raw)!;
    }
    return null;
  }

  public getStatus(): CommunityCatalogStatus {
    return {
      ofd: { ...this.status.ofd },
      spoolmandb: { ...this.status.spoolmandb },
    };
  }

  public setStatus(source: "ofd" | "spoolmandb", status: CatalogSourceStatus): void {
    this.status[source] = status;
  }

  public parseOfdDataset(data: OfdDataset): CommunityCatalogItem[] {
    const brandMap = new Map<string, OfdBrand>();
    for (const brand of data.brands || []) {
      if (brand?.id) {
        brandMap.set(brand.id, brand);
      }
    }

    const filamentMap = new Map<string, OfdFilament>();
    for (const fil of data.filaments || []) {
      if (fil?.id) {
        filamentMap.set(fil.id, fil);
      }
    }

    // Map size to variant to filament to brand
    const sizesByVariant = new Map<string, OfdSize[]>();
    for (const s of data.sizes || []) {
      if (!s?.variant_id) continue;
      const existing = sizesByVariant.get(s.variant_id) || [];
      existing.push(s);
      sizesByVariant.set(s.variant_id, existing);
    }

    const items: CommunityCatalogItem[] = [];

    for (const variant of data.variants || []) {
      if (!variant?.id || !variant?.filament_id) continue;
      const filament = filamentMap.get(variant.filament_id);
      if (!filament) continue;
      const brand = brandMap.get(filament.brand_id);
      const mfg = brand ? brand.name : "Unknown";

      // Extract slicer settings if available (prioritizing popular slicers)
      let extruderTemp: number | null = null;
      let bedTemp: number | null = null;
      if (filament.slicer_settings && typeof filament.slicer_settings === "object") {
        const preferredSlicers = ["orca", "bambu_studio", "prusa_slicer", "cura"];
        for (const name of preferredSlicers) {
          const s = filament.slicer_settings[name];
          if (s && typeof s === "object") {
            if (s.extruder_temp && extruderTemp === null) extruderTemp = s.extruder_temp;
            if (s.bed_temp && bedTemp === null) bedTemp = s.bed_temp;
          }
        }
        for (const slicer of Object.values(filament.slicer_settings)) {
          if (slicer && typeof slicer === "object") {
            if (slicer.extruder_temp && extruderTemp === null) extruderTemp = slicer.extruder_temp;
            if (slicer.bed_temp && bedTemp === null) bedTemp = slicer.bed_temp;
          }
        }
      }

      const colorCode = variant.color_hex
        ? (variant.color_hex.startsWith("#") ? variant.color_hex : `#${variant.color_hex}`)
        : null;

      const sizes = sizesByVariant.get(variant.id) || [];
      if (sizes.length === 0) {
        items.push({
          id: `ofd-v-${variant.id}`,
          source: "ofd",
          manufacturer: mfg,
          material: filament.material,
          name: filament.name,
          colorName: variant.name,
          colorCode,
          density: filament.density ?? null,
          diameter: 1.75,
          weightGrams: 1000,
          spoolRefill: false,
          extruderTemp,
          bedTemp,
          gtin: null,
        });
      } else {
        for (const size of sizes) {
          items.push({
            id: `ofd-s-${size.id}`,
            source: "ofd",
            manufacturer: mfg,
            material: filament.material,
            name: filament.name,
            colorName: variant.name,
            colorCode,
            density: filament.density ?? null,
            diameter: size.diameter ?? 1.75,
            weightGrams: size.filament_weight ?? 1000,
            spoolRefill: size.spool_refill ?? false,
            extruderTemp,
            bedTemp,
            gtin: size.gtin || null,
          });
        }
      }
    }

    return items;
  }

  public parseSpoolmanDbVendorFiles(files: SpoolmanDbVendorFile[]): CommunityCatalogItem[] {
    const items: CommunityCatalogItem[] = [];

    for (const vendor of files) {
      if (!vendor || !vendor.manufacturer || !Array.isArray(vendor.filaments)) {
        continue;
      }

      for (const fil of vendor.filaments) {
        if (!fil || typeof fil.name !== "string" || typeof fil.material !== "string") {
          continue;
        }

        const colors = fil.colors && fil.colors.length > 0 ? fil.colors : [{ name: "Unknown", hex: "" }];
        const diameter = fil.diameters?.[0] ?? 1.75;

        for (const col of colors) {
          const colName = col?.name || "Unknown";
          const name = fil.name.replace("{color_name}", colName);
          const colorCode = col?.hex ? (col.hex.startsWith("#") ? col.hex : `#${col.hex}`) : null;

          items.push({
            id: `spoolmandb-${vendor.manufacturer}-${name}-${colName}`,
            source: "spoolmandb",
            manufacturer: vendor.manufacturer,
            material: fil.material,
            name,
            colorName: colName,
            colorCode,
            density: fil.density ?? null,
            diameter,
            weightGrams: 1000,
            spoolRefill: false,
            extruderTemp: fil.extruder_temp ?? null,
            bedTemp: fil.bed_temp ?? null,
            gtin: null,
          });
        }
      }
    }

    return items;
  }

  public async loadFromDisk(): Promise<void> {
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (err) {
        logger.warn(`Failed to create catalog cache dir ${this.cacheDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    try {
      const ofdFile = path.join(this.cacheDir, "ofd.json");
      if (fs.existsSync(ofdFile)) {
        const raw = fs.readFileSync(ofdFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          this.setSourceItems("ofd", parsed.items, parsed.lastUpdated || null);
          logger.info(`Loaded ${parsed.items.length} OFD catalog items from disk cache.`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load OFD catalog from disk: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const spoolmanFile = path.join(this.cacheDir, "spoolmandb.json");
      if (fs.existsSync(spoolmanFile)) {
        const raw = fs.readFileSync(spoolmanFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          this.setSourceItems("spoolmandb", parsed.items, parsed.lastUpdated || null);
          logger.info(`Loaded ${parsed.items.length} SpoolmanDB catalog items from disk cache.`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load SpoolmanDB catalog from disk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async saveToDisk(source: "ofd" | "spoolmandb"): Promise<void> {
    const fileName = source === "ofd" ? "ofd.json" : "spoolmandb.json";
    const filePath = path.join(this.cacheDir, fileName);
    const tmpPath = path.join(this.cacheDir, `${fileName}.${Date.now()}.tmp`);
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const items = this.items.filter((item) => item.source === source);
      const payload = {
        lastUpdated: this.status[source].lastUpdated,
        items,
      };
      fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf-8");
      fs.renameSync(tmpPath, filePath);
    } catch (error) {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // ignore cleanup error
        }
      }
      logger.warn(`Failed to save community catalog ${source} to disk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async sync(source: "ofd" | "spoolmandb" | "all" = "all"): Promise<{ ofdCount: number; spoolmanCount: number }> {
    if (this.syncing) {
      throw new CatalogSyncConflictError();
    }
    this.syncing = true;
    try {
      let ofdCount = 0;
      let spoolmanCount = 0;
      const errors: Error[] = [];

      if (source === "ofd" || source === "all") {
        try {
          ofdCount = await this.syncOfdInternal();
        } catch (err) {
          logger.error("OFD catalog sync failed:", err);
          if (source === "ofd") throw err;
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }

      if (source === "spoolmandb" || source === "all") {
        try {
          spoolmanCount = await this.syncSpoolmanDbInternal();
        } catch (err) {
          logger.error("SpoolmanDB catalog sync failed:", err);
          if (source === "spoolmandb") throw err;
          errors.push(err instanceof Error ? err : new Error(String(err)));
        }
      }

      if (source === "all" && errors.length === 2) {
        throw new Error(`All catalog sync sources failed: ${errors.map((e) => e.message).join("; ")}`);
      }

      return { ofdCount, spoolmanCount };
    } finally {
      this.syncing = false;
    }
  }

  public async syncOfd(): Promise<number> {
    const res = await this.sync("ofd");
    return res.ofdCount;
  }

  public async syncSpoolmanDb(): Promise<number> {
    const res = await this.sync("spoolmandb");
    return res.spoolmanCount;
  }

  private async syncOfdInternal(): Promise<number> {
    const url = "https://api.openfilamentdatabase.org/json/all.json.gz";
    const res = await fetch(url, {
      headers: { "User-Agent": "Filadex/1.0" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch OFD: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const unzipped = zlib.gunzipSync(buffer).toString("utf-8");
    const data: OfdDataset = JSON.parse(unzipped);
    const items = this.parseOfdDataset(data);
    if (items.length === 0) {
      throw new Error("OFD catalog sync returned 0 items; preserving existing cache");
    }
    const lastUpdated = data.generated_at || new Date().toISOString();
    this.setSourceItems("ofd", items, lastUpdated);
    await this.saveToDisk("ofd");
    return items.length;
  }

  private async syncSpoolmanDbInternal(): Promise<number> {
    const repo = "Donkie/SpoolmanDB";
    const headers: Record<string, string> = { "User-Agent": "Filadex/1.0" };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!treeRes.ok) {
      throw new Error(`Failed to list SpoolmanDB tree: ${treeRes.status} ${treeRes.statusText}`);
    }
    const treeData = (await treeRes.json()) as { tree: Array<{ path: string; type: string }> };
    const paths = treeData.tree
      .filter((entry) => entry.type === "blob" && entry.path.startsWith("filaments/") && entry.path.endsWith(".json"))
      .map((entry) => entry.path);

    const vendorFiles: SpoolmanDbVendorFile[] = [];
    const BATCH_SIZE = 8;
    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const chunk = paths.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        chunk.map(async (p) => {
          try {
            const fileRes = await fetch(`https://raw.githubusercontent.com/${repo}/main/${p}`, {
              headers,
              signal: AbortSignal.timeout(15_000),
            });
            if (fileRes.ok) {
              const text = await fileRes.text();
              try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === "object") {
                  return parsed as SpoolmanDbVendorFile;
                }
              } catch {
                logger.warn(`Failed to parse JSON from SpoolmanDB file ${p}`);
              }
            } else {
              logger.warn(`Failed to fetch SpoolmanDB file ${p}: HTTP ${fileRes.status} ${fileRes.statusText}`);
            }
          } catch (err) {
            logger.warn(`Failed to fetch SpoolmanDB file ${p}: ${err instanceof Error ? err.message : String(err)}`);
          }
          return null;
        })
      );
      for (const item of results) {
        if (item) vendorFiles.push(item);
      }
    }

    if (paths.length > 0 && vendorFiles.length === 0) {
      throw new Error(`Failed to fetch SpoolmanDB vendor files: all ${paths.length} file downloads failed`);
    }

    if (paths.length > 0 && vendorFiles.length < paths.length * 0.5) {
      throw new Error(
        `Failed to fetch SpoolmanDB vendor files: too many download errors (${vendorFiles.length}/${paths.length} succeeded); preserving existing cache`
      );
    }

    const items = this.parseSpoolmanDbVendorFiles(vendorFiles);
    if (paths.length > 0 && items.length === 0) {
      throw new Error("SpoolmanDB catalog sync returned 0 items; preserving existing cache");
    }
    const lastUpdated = new Date().toISOString();
    this.setSourceItems("spoolmandb", items, lastUpdated);
    await this.saveToDisk("spoolmandb");
    return items.length;
  }
}

export const communityCatalog = new CommunityCatalogService();
