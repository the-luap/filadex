import fs from "fs";
import path from "path";
import zlib from "zlib";
import { z } from "zod";
import { logger } from "../utils/logger";
import type { CommunityCatalogItem } from "@shared/schema";

export type { CommunityCatalogItem };

export const MAX_SPOOLMANDB_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_OFD_RESPONSE_BYTES = 15 * 1024 * 1024;
export const MAX_GUNZIP_OUTPUT_BYTES = 50 * 1024 * 1024;

export interface CatalogSourceStatus {
  count: number;
  lastUpdated: string | null;
}

export interface CommunityCatalogStatus {
  ofd: CatalogSourceStatus;
  spoolmandb: CatalogSourceStatus;
}

export const spoolmanDbColorSchema = z.object({
  name: z.string().max(200),
  hex: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional().default(""),
});

export const spoolmanDbFilamentSchema = z.object({
  name: z.string().max(300),
  material: z.string().max(100),
  density: z.number().optional().nullable(),
  diameters: z.array(z.number()).optional().nullable(),
  extruder_temp: z.number().optional().nullable(),
  bed_temp: z.number().optional().nullable(),
  colors: z.array(spoolmanDbColorSchema).optional().nullable(),
});

export const spoolmanDbVendorFileSchema = z.object({
  manufacturer: z.string().max(200),
  filaments: z.array(spoolmanDbFilamentSchema),
});

export type SpoolmanDbColor = z.infer<typeof spoolmanDbColorSchema>;
export type SpoolmanDbFilament = z.infer<typeof spoolmanDbFilamentSchema>;
export type SpoolmanDbVendorFile = z.infer<typeof spoolmanDbVendorFileSchema>;

export const ofdBrandSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  slug: z.string().optional(),
});

export const ofdFilamentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  brand_id: z.union([z.string(), z.number()]).transform(String).optional().nullable(),
  name: z.string(),
  material: z.string().optional().default(""),
  density: z.number().optional().nullable(),
  min_print_temperature: z.number().optional().nullable(),
  max_print_temperature: z.number().optional().nullable(),
  min_bed_temperature: z.number().optional().nullable(),
  max_bed_temperature: z.number().optional().nullable(),
  slicer_settings: z.record(z.any()).optional().nullable(),
});

export const ofdVariantSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  filament_id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional().default(""),
  color_hex: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional().nullable(),
});

export const ofdSizeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  variant_id: z.union([z.string(), z.number()]).transform(String),
  diameter: z.number().optional().nullable(),
  filament_weight: z.number().optional().nullable(),
  spool_refill: z.boolean().optional().nullable(),
  gtin: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional().nullable(),
});

export type OfdBrand = z.infer<typeof ofdBrandSchema>;
export type OfdFilament = z.infer<typeof ofdFilamentSchema>;
export type OfdVariant = z.infer<typeof ofdVariantSchema>;
export type OfdSize = z.infer<typeof ofdSizeSchema>;

export interface OfdDataset {
  version: string;
  generated_at: string;
  brands: OfdBrand[];
  filaments: OfdFilament[];
  variants: OfdVariant[];
  sizes: OfdSize[];
}

function normalizeGtin(gtin: string): string {
  return String(gtin).trim().replace(/^0+/, "");
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
  private gtinMap: Map<string, CommunityCatalogItem[]> = new Map();
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
    const nextGtinMap = new Map<string, CommunityCatalogItem[]>();
    for (const item of this.items) {
      if (item.gtin) {
        const raw = typeof item.gtin === "string" ? item.gtin.trim() : String(item.gtin).trim();
        const norm = normalizeGtin(raw);
        if (norm) {
          const list = nextGtinMap.get(norm) || [];
          list.push(item);
          nextGtinMap.set(norm, list);
        }
        if (raw && raw !== norm) {
          const list = nextGtinMap.get(raw) || [];
          list.push(item);
          nextGtinMap.set(raw, list);
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

  public lookupGtinCandidates(gtin: string): CommunityCatalogItem[] {
    if (!gtin || !String(gtin).trim()) {
      return [];
    }
    const raw = String(gtin).trim();
    const norm = normalizeGtin(raw);
    if (norm && this.gtinMap.has(norm)) {
      return this.gtinMap.get(norm)!;
    }
    if (this.gtinMap.has(raw)) {
      return this.gtinMap.get(raw)!;
    }
    return [];
  }

  public lookupGtin(
    gtin: string,
    hint?: { diameter?: number; weightGrams?: number; spoolRefill?: boolean }
  ): CommunityCatalogItem | null {
    const candidates = this.lookupGtinCandidates(gtin);
    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    if (hint) {
      const match = candidates.find((c) => {
        if (hint.spoolRefill !== undefined && c.spoolRefill !== null && c.spoolRefill !== hint.spoolRefill) {
          return false;
        }
        if (hint.weightGrams !== undefined && c.weightGrams !== null && c.weightGrams !== hint.weightGrams) {
          return false;
        }
        if (hint.diameter !== undefined && c.diameter !== null && Math.abs(c.diameter - hint.diameter) > 0.05) {
          return false;
        }
        return true;
      });
      if (match) {
        return match;
      }
    }

    // Default preference: standard spooled 1kg, then standard spooled, then first candidate
    const preferred = candidates.find((c) => c.spoolRefill === false && c.weightGrams === 1000)
      || candidates.find((c) => c.spoolRefill === false)
      || candidates[0];
    return preferred;
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
    for (const rawBrand of data.brands || []) {
      const parsed = ofdBrandSchema.safeParse(rawBrand);
      if (parsed.success) {
        brandMap.set(parsed.data.id, parsed.data);
      }
    }

    const filamentMap = new Map<string, OfdFilament>();
    for (const rawFil of data.filaments || []) {
      const parsed = ofdFilamentSchema.safeParse(rawFil);
      if (parsed.success) {
        filamentMap.set(parsed.data.id, parsed.data);
      }
    }

    // Map size to variant to filament to brand
    const sizesByVariant = new Map<string, OfdSize[]>();
    for (const rawSize of data.sizes || []) {
      const parsed = ofdSizeSchema.safeParse(rawSize);
      if (!parsed.success || !parsed.data.variant_id) continue;
      const existing = sizesByVariant.get(parsed.data.variant_id) || [];
      existing.push(parsed.data);
      sizesByVariant.set(parsed.data.variant_id, existing);
    }

    const items: CommunityCatalogItem[] = [];

    for (const rawVariant of data.variants || []) {
      const parsedVariant = ofdVariantSchema.safeParse(rawVariant);
      if (!parsedVariant.success) continue;
      const variant = parsedVariant.data;

      const filament = filamentMap.get(variant.filament_id);
      if (!filament) continue;
      const brand = filament.brand_id ? brandMap.get(filament.brand_id) : undefined;
      const mfg = brand ? brand.name : "Unknown";

      // Determine extruder and bed temperatures:
      // OFD filaments store temperatures at top-level min/max fields
      let extruderTemp: number | null = null;
      let bedTemp: number | null = null;

      if (filament.min_print_temperature != null && filament.max_print_temperature != null) {
        extruderTemp = Math.round((filament.min_print_temperature + filament.max_print_temperature) / 2);
      } else if (filament.min_print_temperature != null) {
        extruderTemp = filament.min_print_temperature;
      } else if (filament.max_print_temperature != null) {
        extruderTemp = filament.max_print_temperature;
      }

      if (filament.max_bed_temperature != null) {
        if (filament.min_bed_temperature != null && filament.min_bed_temperature > 30) {
          bedTemp = Math.round((filament.min_bed_temperature + filament.max_bed_temperature) / 2);
        } else {
          bedTemp = filament.max_bed_temperature;
        }
      } else if (filament.min_bed_temperature != null) {
        bedTemp = filament.min_bed_temperature;
      }

      // Check slicer settings if temperatures are still missing
      if ((extruderTemp === null || bedTemp === null) && filament.slicer_settings && typeof filament.slicer_settings === "object") {
        const preferredSlicers = ["orca", "bambu_studio", "prusa_slicer", "cura"];
        for (const name of preferredSlicers) {
          const s = filament.slicer_settings[name];
          if (s && typeof s === "object") {
            if (s.extruder_temp && extruderTemp === null && typeof s.extruder_temp === "number") extruderTemp = s.extruder_temp;
            if (s.bed_temp && bedTemp === null && typeof s.bed_temp === "number") bedTemp = s.bed_temp;
          }
        }
        for (const slicer of Object.values(filament.slicer_settings)) {
          if (slicer && typeof slicer === "object") {
            if (slicer.extruder_temp && extruderTemp === null && typeof slicer.extruder_temp === "number") extruderTemp = slicer.extruder_temp;
            if (slicer.bed_temp && bedTemp === null && typeof slicer.bed_temp === "number") bedTemp = slicer.bed_temp;
          }
        }
      }

      const hexStr = typeof variant.color_hex === "string"
        ? variant.color_hex.trim()
        : (variant.color_hex != null ? String(variant.color_hex).trim() : "");
      const colorCode = hexStr
        ? (hexStr.startsWith("#") ? hexStr : `#${hexStr}`)
        : null;

      const sizes = sizesByVariant.get(variant.id) || [];
      if (sizes.length === 0) {
        items.push({
          id: `ofd-v-${variant.id}`,
          source: "ofd",
          manufacturer: mfg,
          material: filament.material || "",
          name: filament.name,
          colorName: variant.name || "",
          colorCode,
          density: filament.density ?? null,
          diameter: 1.75,
          weightGrams: null,
          spoolRefill: null,
          extruderTemp,
          bedTemp,
          gtin: null,
        });
      } else {
        for (const size of sizes) {
          items.push({
            id: `ofd-s-${size.id || variant.id}`,
            source: "ofd",
            manufacturer: mfg,
            material: filament.material || "",
            name: filament.name,
            colorName: variant.name || "",
            colorCode,
            density: filament.density ?? null,
            diameter: size.diameter ?? 1.75,
            weightGrams: size.filament_weight ?? null,
            spoolRefill: size.spool_refill ?? null,
            extruderTemp,
            bedTemp,
            gtin: size.gtin ? String(size.gtin).trim() : null,
          });
        }
      }
    }

    return items;
  }

  public parseSpoolmanDbVendorFiles(files: SpoolmanDbVendorFile[]): CommunityCatalogItem[] {
    const items: CommunityCatalogItem[] = [];

    for (const rawVendor of files) {
      const parsedVendor = spoolmanDbVendorFileSchema.safeParse(rawVendor);
      if (!parsedVendor.success) {
        logger.warn(`Skipping malformed SpoolmanDB vendor file: ${parsedVendor.error.errors[0]?.message ?? "unexpected shape"}`);
        continue;
      }
      const vendor = parsedVendor.data;

      for (const fil of vendor.filaments) {
        const colors = fil.colors && fil.colors.length > 0 ? fil.colors : [{ name: "Unknown", hex: "" }];
        const diameter = fil.diameters?.[0] ?? 1.75;

        for (const col of colors) {
          const colName = col.name || "Unknown";
          const name = fil.name.replace("{color_name}", colName);
          const colHex = typeof col.hex === "string" ? col.hex.trim() : (col.hex ? String(col.hex).trim() : "");
          const colorCode = colHex ? (colHex.startsWith("#") ? colHex : `#${colHex}`) : null;

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
            weightGrams: null,
            spoolRefill: null,
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
          const validItems = this.sanitizeLoadedItems(parsed.items, "ofd");
          this.setSourceItems("ofd", validItems, parsed.lastUpdated || null);
          logger.info(`Loaded ${validItems.length} OFD catalog items from disk cache.`);
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
          const validItems = this.sanitizeLoadedItems(parsed.items, "spoolmandb");
          this.setSourceItems("spoolmandb", validItems, parsed.lastUpdated || null);
          logger.info(`Loaded ${validItems.length} SpoolmanDB catalog items from disk cache.`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to load SpoolmanDB catalog from disk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private sanitizeLoadedItems(items: any[], defaultSource: "ofd" | "spoolmandb"): CommunityCatalogItem[] {
    const validItems: CommunityCatalogItem[] = [];
    for (const item of items) {
      if (item && typeof item === "object" && item.id && item.name && item.material) {
        validItems.push({
          id: String(item.id),
          source: item.source === "spoolmandb" || item.source === "ofd" ? item.source : defaultSource,
          manufacturer: String(item.manufacturer || "Unknown"),
          material: String(item.material || ""),
          name: String(item.name || ""),
          colorName: String(item.colorName || ""),
          colorCode: item.colorCode ? String(item.colorCode) : null,
          density: typeof item.density === "number" ? item.density : null,
          diameter: typeof item.diameter === "number" ? item.diameter : null,
          weightGrams: typeof item.weightGrams === "number" ? item.weightGrams : null,
          spoolRefill: typeof item.spoolRefill === "boolean" ? item.spoolRefill : null,
          extruderTemp: typeof item.extruderTemp === "number" ? item.extruderTemp : null,
          bedTemp: typeof item.bedTemp === "number" ? item.bedTemp : null,
          gtin: item.gtin ? String(item.gtin).trim() : null,
        });
      }
    }
    return validItems;
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
    if (arrayBuffer.byteLength > MAX_OFD_RESPONSE_BYTES) {
      throw new Error(`OFD response exceeds maximum allowed size (${arrayBuffer.byteLength} > ${MAX_OFD_RESPONSE_BYTES} bytes)`);
    }
    const buffer = Buffer.from(arrayBuffer);
    const unzipped = zlib.gunzipSync(buffer, { maxOutputLength: MAX_GUNZIP_OUTPUT_BYTES }).toString("utf-8");
    const data: OfdDataset = JSON.parse(unzipped);
    const items = this.parseOfdDataset(data);
    if (items.length === 0) {
      throw new Error("OFD catalog sync returned 0 items; preserving existing cache");
    }
    const lastUpdated = new Date().toISOString();
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
              if (text.length > MAX_SPOOLMANDB_RESPONSE_BYTES) {
                logger.warn(`SpoolmanDB file ${p} exceeded size limit (${text.length} bytes)`);
                return null;
              }
              try {
                const parsed = JSON.parse(text);
                const validated = spoolmanDbVendorFileSchema.safeParse(parsed);
                if (validated.success) {
                  return validated.data;
                } else {
                  logger.warn(`Skipping malformed SpoolmanDB file ${p}: ${validated.error.errors[0]?.message ?? "unexpected shape"}`);
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
