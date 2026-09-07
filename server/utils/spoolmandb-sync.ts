import { z } from "zod";
import { type CommunityFilamentCacheEntry } from "@shared/schema";
import { storage, type NewCommunityFilament } from "../storage";
import { logger } from "./logger";

const REPO = "Donkie/SpoolmanDB";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;

// The upstream is trusted to be SpoolmanDB, not to be well-formed: a request
// that never answers, a response that never ends, or a file whose shape has
// changed must each fail that one file or that one refresh, not hang the
// server or fill the cache with whatever arrived.
const FETCH_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

const spoolmanDbColorSchema = z.object({
  name: z.string().max(200),
  hex: z.string().max(20).optional().default(""),
});

const spoolmanDbFilamentSchema = z.object({
  name: z.string().max(300),
  material: z.string().max(100),
  density: z.number().optional(),
  diameters: z.array(z.number()).optional(),
  extruder_temp: z.number().int().optional(),
  bed_temp: z.number().int().optional(),
  colors: z.array(spoolmanDbColorSchema).optional(),
});

const spoolmanDbVendorFileSchema = z.object({
  manufacturer: z.string().max(200),
  filaments: z.array(spoolmanDbFilamentSchema),
});

type SpoolmanDbFilament = z.infer<typeof spoolmanDbFilamentSchema>;
type SpoolmanDbVendorFile = z.infer<typeof spoolmanDbVendorFileSchema>;

const treeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`response larger than ${MAX_RESPONSE_BYTES} bytes`);
  }
  return JSON.parse(text);
}

async function fetchVendorFilePaths(): Promise<string[]> {
  let data: unknown;
  try {
    data = await fetchJson(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`);
  } catch (error) {
    throw new Error(`Failed to list SpoolmanDB tree: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return treeSchema.parse(data).tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith("filaments/") && entry.path.endsWith(".json"))
    .map((entry) => entry.path);
}

async function fetchVendorFile(path: string): Promise<SpoolmanDbVendorFile | null> {
  let data: unknown;
  try {
    data = await fetchJson(`${RAW_BASE}/${path}`);
  } catch (error) {
    logger.warn(`Failed to fetch SpoolmanDB file ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  const parsed = spoolmanDbVendorFileSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn(`Skipping SpoolmanDB file ${path}: ${parsed.error.errors[0]?.message ?? "unexpected shape"}`);
    return null;
  }
  return parsed.data;
}

function toCacheRows(vendorFile: SpoolmanDbVendorFile): NewCommunityFilament[] {
  const rows: NewCommunityFilament[] = [];
  const diameter = (filament: SpoolmanDbFilament) => filament.diameters?.[0]?.toString();

  for (const filament of vendorFile.filaments) {
    const colors = filament.colors && filament.colors.length > 0 ? filament.colors : [{ name: "Unknown", hex: "" }];
    for (const color of colors) {
      // SpoolmanDB's `name` field is a template that's documented to contain
      // the literal placeholder `{color_name}` for products named after
      // their color (e.g. Bambu Lab's Basic PLA line).
      const name = filament.name.replace("{color_name}", color.name);
      rows.push({
        manufacturer: vendorFile.manufacturer,
        material: filament.material,
        name,
        colorName: color.name,
        colorCode: color.hex ? `#${color.hex.replace(/^#/, "")}` : null,
        density: filament.density?.toString(),
        diameter: diameter(filament),
        extruderTemp: filament.extruder_temp,
        bedTemp: filament.bed_temp,
      });
    }
  }
  return rows;
}

/**
 * Fetches every vendor filament profile from SpoolmanDB and replaces the
 * local cache with the fresh set. Admin-triggered (see
 * POST /api/community-filaments/refresh) rather than automatic - this hits
 * an external repo, and an operator should decide when that happens.
 */
export async function refreshCommunityFilamentCache(): Promise<number> {
  const paths = await fetchVendorFilePaths();
  logger.info(`Refreshing community filament cache from ${paths.length} SpoolmanDB vendor files...`);

  const allRows: NewCommunityFilament[] = [];
  for (const path of paths) {
    const vendorFile = await fetchVendorFile(path);
    if (vendorFile) {
      allRows.push(...toCacheRows(vendorFile));
    }
  }

  await storage.replaceCommunityFilaments(allRows);

  logger.info(`Community filament cache refreshed: ${allRows.length} entries`);
  return allRows.length;
}

export async function searchCommunityFilaments(query: string, limit = 20): Promise<CommunityFilamentCacheEntry[]> {
  return await storage.searchCommunityFilaments(query, limit);
}
