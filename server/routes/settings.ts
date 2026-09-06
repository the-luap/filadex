import type { Express } from "express";
import { storage } from "../storage";
import {
  insertManufacturerSchema,
  insertMaterialSchema,
  updateMaterialSchema,
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
import { foldMaterialName } from "../utils/materials";

// Two diameters are the same when they are the same number: "1.750" and "1.75"
// name one filament width. Non-numeric text falls back to an exact comparison
// rather than collapsing to 0, which is what Number() would do with it.
function sameDiameter(a: string, b: string): boolean {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return left === right;
  }
  return a.trim() === b.trim();
}

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
    // Exact match, matching manufacturers_name_key. Without it a repeat of a
    // name already in the list reaches the unique index and comes back as a
    // bare 500 - every install is seeded with a few, so retyping one in the Add
    // form is the ordinary case rather than an edge one.
    //
    // Exactly what the index compares, so this rejects only what the database
    // was going to reject anyway. Deliberately not caseless and deliberately
    // not trimmed: `Prusa` alongside `prusa`, and `" Prusa"` alongside
    // `"Prusa"`, are both accepted today, and refusing either would be a
    // behaviour change rather than a fix. The CSV import does compare caselessly
    // (simpleNameParseLine), so the two paths still disagree - see #11, which is
    // where that decision belongs.
    duplicateOf: (item, data) => item.name === data.name,
  });

  registerCrudSettingsRoutes<Material, { name: string; density?: string | null; isHygroscopic?: boolean | null }>(app, {
    entityName: "material",
    basePath: "/api/materials",
    csvFilename: "materials.csv",
    insertSchema: insertMaterialSchema,
    // Fills in density/isHygroscopic on a row that already exists - creation
    // stays admin-only and global (see the POST comment below), but once a
    // declared material has auto-registered a row, the owner needs a way to
    // make it actually do something. Same admin-or-owner rule as delete.
    update: {
      schema: updateMaterialSchema,
      apply: (id, data) => storage.updateMaterial(id, data),
    },
    userScoped: true,
    storage: {
      getAll: (userId) => storage.getMaterials(userId),
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
    // The rule a create has to satisfy: the same fold storage.resolveMaterial
    // matches on. So a second "petg" alongside "PETG" is a 409 rather than a
    // unique-violation 500 - and so is "Äbs" alongside "äbs", which
    // materials_global_name_lower_idx does not catch on SQLite.
    duplicateOf: (item, data) => foldMaterialName(item.name) === foldMaterialName(data.name),
    // Case-insensitive and whitespace-trimmed, to agree with how a declared
    // material resolves to a Catalog Material (storage.resolveMaterial).
    isInUse: (filament: Filament, item) =>
      foldMaterialName(filament.material) === foldMaterialName(item.name),
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
        if (existing.some((d) => sameDiameter(d.value, value))) {
          return { kind: "duplicate" };
        }
        return { kind: "create", data: { value } };
      },
    },
    // diameters.value is `numeric UNIQUE` on Postgres, where "1.750" collides
    // with the existing "1.75" and surfaces as a bare 500, and `text UNIQUE` on
    // SQLite, where it does not collide at all and a second row that looks
    // identical appears in the list. Deciding it here makes both engines answer
    // 409, on the same rule a declared diameter finds its filament type by
    // (eqNumeric).
    duplicateOf: (item, data) => sameDiameter(item.value, data.value),
    isInUse: (filament: Filament, item) => filament.diameter !== null && sameDiameter(filament.diameter, String(item.value)),
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
    // Exact match, matching storage_locations_name_key - same reasoning as
    // manufacturers above, including why it is neither caseless nor trimmed.
    duplicateOf: (item, data) => item.name === data.name,
  });
}
