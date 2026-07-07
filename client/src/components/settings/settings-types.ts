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
  density: string | null;
  isHygroscopic: boolean | null;
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

