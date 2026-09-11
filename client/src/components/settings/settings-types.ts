import { z } from "zod";

export type CatalogRequestEntityType = "manufacturer" | "material" | "color" | "diameter" | "storageLocation";

export interface CatalogRequest {
  id: number;
  entityType: CatalogRequestEntityType;
  payload: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy?: string; // present on the admin review queue response only
}

// Type definitions for the lists
export interface Manufacturer {
  id: number;
  name: string;
  createdAt: string;
}

export interface Material {
  id: number;
  name: string;
  // null = Global Catalog; set = the owning user's Personal Catalog entry.
  userId: number | null;
  density: string | null;
  isHygroscopic: boolean | null;
  // Set once the owner has answered the "needs attention" prompt, so a material
  // that genuinely has no density and genuinely is not hygroscopic stops being
  // flagged. Always false on a Global Catalog row, which is never flagged.
  attentionDismissed: boolean;
  createdAt: string;
}

export interface Color {
  id: number;
  name: string;
  code: string;
  createdAt: string;
}

export interface Diameter {
  id: number;
  value: string;
  createdAt: string;
}

export interface StorageLocation {
  id: number;
  name: string;
  createdAt: string;
}

export interface GenericTerm {
  id: number;
  word: string;
  createdAt: string;
}

// Validation schemas with translations
export const createManufacturerSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.manufacturers.nameRequired'))
});

export const createMaterialSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.materials.nameRequired')),
  density: z.string().optional().transform((v) => (v ? v : undefined)),
  isHygroscopic: z.boolean().optional()
});

export const createColorSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.colors.nameRequired')),
  code: z.string().min(1, t('settings.colors.codeRequired'))
});

export const createDiameterSchema = (t: (key: string) => string) => z.object({
  value: z.string().min(1, t('settings.diameters.valueRequired'))
});

export const createStorageLocationSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('settings.storageLocations.nameRequired'))
});

export const createGenericTermSchema = (t: (key: string) => string) => z.object({
  word: z.string().min(1, t('settings.genericTerms.wordRequired'))
});

