import type { Express } from "express";
import { storage } from "../storage";
import {
  insertManufacturerSchema,
  insertMaterialSchema,
  insertColorSchema,
  insertDiameterSchema,
  insertStorageLocationSchema,
  type Manufacturer,
  type Material,
  type Color,
  type Diameter,
  type StorageLocation,
  type Filament,
} from "@shared/schema";
import { parseCSVLine, escapeCsvField } from "../utils/csv-parser";
import { registerCrudSettingsRoutes, simpleNameParseLine } from "../utils/settings-crud";

export function registerSettingsRoutes(app: Express): void {
  registerCrudSettingsRoutes<Manufacturer, { name: string }>(app, {
    entityName: "manufacturer",
    basePath: "/api/manufacturers",
    csvFilename: "manufacturers.csv",
    insertSchema: insertManufacturerSchema,
    storage: {
      getAll: () => storage.getManufacturers(),
      create: (data) => storage.createManufacturer(data),
      delete: (id) => storage.deleteManufacturer(id),
      updateOrder: (id, newOrder) => storage.updateManufacturerOrder(id, newOrder),
    },
    csv: {
      exportHeader: "name",
      exportRow: (item) => `${escapeCsvField(item.name)}\n`,
      isHeaderRow: (line) => /name|hersteller|vendor/i.test(line),
      parseLine: simpleNameParseLine,
    },
    isInUse: (filament: Filament, item) => filament.manufacturer === item.name,
  });

  registerCrudSettingsRoutes<Material, { name: string; density?: string | null; isHygroscopic?: boolean | null }>(app, {
    entityName: "material",
    basePath: "/api/materials",
    csvFilename: "materials.csv",
    insertSchema: insertMaterialSchema,
    storage: {
      getAll: () => storage.getMaterials(),
      create: (data) => storage.createMaterial(data),
      delete: (id) => storage.deleteMaterial(id),
      updateOrder: (id, newOrder) => storage.updateMaterialOrder(id, newOrder),
    },
    csv: {
      exportHeader: "name,density,isHygroscopic",
      exportRow: (item) =>
        `${escapeCsvField(item.name)},${escapeCsvField(item.density)},${escapeCsvField(item.isHygroscopic)}\n`,
      isHeaderRow: (line) => /name|material|type/i.test(line),
      parseLine: (line, existing) => {
        const [rawName, rawDensity, rawIsHygroscopic] = parseCSVLine(line);
        const name = rawName?.trim();
        if (!name) return { kind: "skip" };
        if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
          return { kind: "duplicate" };
        }

        const density = rawDensity?.trim() ? rawDensity.trim() : undefined;
        const isHygroscopic = /^(true|yes|1)$/i.test(rawIsHygroscopic?.trim() ?? "");

        return { kind: "create", data: { name, density, isHygroscopic } };
      },
    },
    isInUse: (filament: Filament, item) => filament.material === item.name,
  });

  registerCrudSettingsRoutes<Color, { name: string; code: string }>(app, {
    entityName: "color",
    basePath: "/api/colors",
    csvFilename: "colors.csv",
    insertSchema: insertColorSchema,
    storage: {
      getAll: () => storage.getColors(),
      create: (data) => storage.createColor(data),
      delete: (id) => storage.deleteColor(id),
    },
    csv: {
      exportHeader: "name,code",
      exportRow: (item) => `${escapeCsvField(item.name)},${escapeCsvField(item.code)}\n`,
      isHeaderRow: (line) => /name|brand/i.test(line),
      parseLine: (line, existing) => {
        const values = parseCSVLine(line);
        let name: string;
        let code: string;

        if (values.length >= 3) {
          // Format: Brand,Color Name,Hex Code
          const brand = values[0].trim().replace(/"/g, "");
          const colorName = values[1].trim().replace(/"/g, "");
          name = `${colorName} (${brand})`;
          code = values[2].trim().replace(/"/g, "");
        } else if (values.length >= 2) {
          // Format: Name,Code
          name = values[0].trim().replace(/"/g, "");
          code = values[1].trim().replace(/"/g, "");
        } else {
          return { kind: "error" };
        }

        if (!name || !code) return { kind: "error" };
        if (!code.startsWith("#")) code = "#" + code;

        if (
          existing.some(
            (c) => c.name.toLowerCase() === name.toLowerCase() && c.code.toLowerCase() === code.toLowerCase()
          )
        ) {
          return { kind: "duplicate" };
        }

        return { kind: "create", data: { name, code } };
      },
    },
    isInUse: (filament: Filament, item) => filament.colorName === item.name || filament.colorCode === item.code,
  });

  registerCrudSettingsRoutes<Diameter, { value: string }>(app, {
    entityName: "diameter",
    basePath: "/api/diameters",
    csvFilename: "diameters.csv",
    insertSchema: insertDiameterSchema,
    storage: {
      getAll: () => storage.getDiameters(),
      create: (data) => storage.createDiameter(data),
      delete: (id) => storage.deleteDiameter(id),
    },
    csv: {
      exportHeader: "value",
      exportRow: (item) => `${escapeCsvField(item.value)}\n`,
      isHeaderRow: (line) => /value/i.test(line),
      parseLine: (line, existing) => {
        const [rawValue] = parseCSVLine(line);
        const value = rawValue?.trim();
        if (!value) return { kind: "skip" };
        if (existing.some((d) => d.value.toLowerCase() === value.toLowerCase())) {
          return { kind: "duplicate" };
        }
        return { kind: "create", data: { value } };
      },
    },
    isInUse: (filament: Filament, item) => filament.diameter === String(item.value),
  });

  registerCrudSettingsRoutes<StorageLocation, { name: string }>(app, {
    entityName: "storage location",
    basePath: "/api/storage-locations",
    csvFilename: "storage-locations.csv",
    insertSchema: insertStorageLocationSchema,
    storage: {
      getAll: () => storage.getStorageLocations(),
      create: (data) => storage.createStorageLocation(data),
      delete: (id) => storage.deleteStorageLocation(id),
      updateOrder: (id, newOrder) => storage.updateStorageLocationOrder(id, newOrder),
    },
    csv: {
      exportHeader: "name",
      exportRow: (item) => `${escapeCsvField(item.name)}\n`,
      isHeaderRow: (line) => /name/i.test(line),
      parseLine: simpleNameParseLine,
    },
    isInUse: (filament: Filament, item) => filament.storageLocation === item.name,
  });
}
