import fs from "fs";
import path from "path";
import zlib from "zlib";
import { logger } from "../utils/logger";

export interface CommunityCatalogItem {
  id: string;
  source: "ofd" | "spoolmandb";
  manufacturer: string;
  material: string;
  name: string;
  colorName: string;
  colorCode: string | null;
  density: number | null;
  diameter: number | null;
  weightGrams: number | null;
  spoolRefill: boolean | null;
  extruderTemp: number | null;
  bedTemp: number | null;
  gtin: string | null;
}

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

export class CommunityCatalogService {
  private items: CommunityCatalogItem[] = [];
  private gtinMap: Map<string, CommunityCatalogItem> = new Map();
  private status: CommunityCatalogStatus = {
    ofd: { count: 0, lastUpdated: null },
    spoolmandb: { count: 0, lastUpdated: null },
  };

  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || process.env.CATALOG_CACHE_DIR || path.join(process.cwd(), "data", "cache", "catalogs");
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
    this.gtinMap.clear();
    for (const item of this.items) {
      if (item.gtin) {
        const raw = item.gtin.trim();
        const norm = normalizeGtin(raw);
        if (norm) {
          this.gtinMap.set(norm, item);
        }
        this.gtinMap.set(raw, item);
      }
    }
  }

  public search(
    query: string,
    options?: { source?: "ofd" | "spoolmandb"; limit?: number }
  ): CommunityCatalogItem[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }

    const limit = options?.limit ?? 20;
    const source = options?.source;
    const results: CommunityCatalogItem[] = [];

    for (const item of this.items) {
      if (source && item.source !== source) {
        continue;
      }

      const matchMfg = item.manufacturer.toLowerCase().includes(q);
      const matchName = item.name.toLowerCase().includes(q);
      const matchColor = item.colorName.toLowerCase().includes(q);
      const matchMaterial = item.material.toLowerCase().includes(q);

      if (matchMfg || matchName || matchColor || matchMaterial) {
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
    if (this.gtinMap.has(raw)) {
      return this.gtinMap.get(raw)!;
    }
    const norm = normalizeGtin(raw);
    if (this.gtinMap.has(norm)) {
      return this.gtinMap.get(norm)!;
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
      brandMap.set(brand.id, brand);
    }

    const filamentMap = new Map<string, OfdFilament>();
    for (const fil of data.filaments || []) {
      filamentMap.set(fil.id, fil);
    }

    const variantMap = new Map<string, OfdVariant>();
    for (const v of data.variants || []) {
      variantMap.set(v.id, v);
    }

    // Map size to variant to filament to brand
    const sizesByVariant = new Map<string, OfdSize[]>();
    for (const s of data.sizes || []) {
      const existing = sizesByVariant.get(s.variant_id) || [];
      existing.push(s);
      sizesByVariant.set(s.variant_id, existing);
    }

    const items: CommunityCatalogItem[] = [];

    for (const variant of data.variants || []) {
      const filament = filamentMap.get(variant.filament_id);
      if (!filament) continue;
      const brand = brandMap.get(filament.brand_id);
      const mfg = brand ? brand.name : "Unknown";

      // Extract slicer settings if available
      let extruderTemp: number | null = null;
      let bedTemp: number | null = null;
      if (filament.slicer_settings) {
        for (const slicer of Object.values(filament.slicer_settings)) {
          if (slicer.extruder_temp && extruderTemp === null) extruderTemp = slicer.extruder_temp;
          if (slicer.bed_temp && bedTemp === null) bedTemp = slicer.bed_temp;
        }
      }

      const sizes = sizesByVariant.get(variant.id) || [];
      if (sizes.length === 0) {
        items.push({
          id: `ofd-v-${variant.id}`,
          source: "ofd",
          manufacturer: mfg,
          material: filament.material,
          name: filament.name,
          colorName: variant.name,
          colorCode: variant.color_hex || null,
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
            colorCode: variant.color_hex || null,
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
      for (const fil of vendor.filaments || []) {
        const colors = fil.colors && fil.colors.length > 0 ? fil.colors : [{ name: "Unknown", hex: "" }];
        const diameter = fil.diameters?.[0] ?? 1.75;

        for (const col of colors) {
          const name = fil.name.replace("{color_name}", col.name);
          const colorCode = col.hex ? (col.hex.startsWith("#") ? col.hex : `#${col.hex}`) : null;

          items.push({
            id: `spoolmandb-${vendor.manufacturer}-${name}-${col.name}`,
            source: "spoolmandb",
            manufacturer: vendor.manufacturer,
            material: fil.material,
            name,
            colorName: col.name,
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
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        return;
      }

      const ofdFile = path.join(this.cacheDir, "ofd.json");
      if (fs.existsSync(ofdFile)) {
        const raw = fs.readFileSync(ofdFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          this.setSourceItems("ofd", parsed.items, parsed.lastUpdated || null);
          logger.info(`Loaded ${parsed.items.length} OFD catalog items from disk cache.`);
        }
      }

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
      logger.warn(`Failed to load community catalog from disk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async saveToDisk(source: "ofd" | "spoolmandb"): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const fileName = source === "ofd" ? "ofd.json" : "spoolmandb.json";
      const filePath = path.join(this.cacheDir, fileName);
      const items = this.items.filter((item) => item.source === source);
      const payload = {
        lastUpdated: this.status[source].lastUpdated,
        items,
      };
      fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
    } catch (error) {
      logger.warn(`Failed to save community catalog ${source} to disk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async syncOfd(): Promise<number> {
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
    const lastUpdated = data.generated_at || new Date().toISOString();
    this.setSourceItems("ofd", items, lastUpdated);
    await this.saveToDisk("ofd");
    return items.length;
  }

  public async syncSpoolmanDb(): Promise<number> {
    const repo = "Donkie/SpoolmanDB";
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`, {
      headers: { "User-Agent": "Filadex/1.0" },
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
    for (const p of paths) {
      try {
        const fileRes = await fetch(`https://raw.githubusercontent.com/${repo}/main/${p}`, {
          headers: { "User-Agent": "Filadex/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (fileRes.ok) {
          const text = await fileRes.text();
          vendorFiles.push(JSON.parse(text));
        }
      } catch (err) {
        logger.warn(`Failed to fetch SpoolmanDB file ${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const items = this.parseSpoolmanDbVendorFiles(vendorFiles);
    const lastUpdated = new Date().toISOString();
    this.setSourceItems("spoolmandb", items, lastUpdated);
    await this.saveToDisk("spoolmandb");
    return items.length;
  }
}

export const communityCatalog = new CommunityCatalogService();
