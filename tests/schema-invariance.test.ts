import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";

/**
 * The client is built once, against shared/columns.pg.ts (vite.config.ts), and
 * served to Postgres and SQLite installs alike. What makes that safe is that
 * shared/schema.ts produces the same Zod schemas under both dialects - so this
 * test compares them, field by field, check by check.
 *
 * It has to go all the way down. An earlier version stopped at the type name,
 * which meant a ZodString's length checks, a ZodNumber's range, a ZodDefault's
 * value and both halves of a ZodPipeline were never compared at all: every
 * integer column already differed across the dialects and the test was green.
 *
 * The one difference that is real and expected is that drizzle-zod derives an
 * integer column's range from the engine's integer width. Those bounds are
 * pulled out of the equality comparison and asserted separately, on the
 * property that actually matters: Postgres, whose schemas the client bundles,
 * must be the narrower of the two. A client that is stricter than the server it
 * talks to rejects input the server would have taken - annoying, visible, and
 * caught in the UI. The reverse ships input the server rejects.
 */

// The integer widths drizzle-zod derives a range from: int4 on Postgres, and
// SQLite's safe-integer range. Only these exact values leave the equality
// comparison; any other bound stays in it and has to match across dialects.
//
// This set is deliberately not a bigint tripwire, and does not read as one: a
// Postgres `bigint({ mode: "number" })` derives the same safe-integer pair
// SQLite's integer does, so it is exempted here too. What holds a widened column
// honest is the separate assertion below - Postgres, whose schemas the client
// bundles, must stay no wider than SQLite. A bigint on both sides passes it
// because neither side is wider; a bigint on Postgres against a narrower SQLite
// column fails it.
const WIDTH_BOUNDS = [-2147483648, 2147483647, -9007199254740991, 9007199254740991];

const script = `
import * as schema from './shared/schema';
import { createInsertSchema } from 'drizzle-zod';
import { isTable } from 'drizzle-orm';
import { z } from 'zod';

const WIDTH_BOUNDS = [-2147483648, 2147483647, -9007199254740991, 9007199254740991];
const bounds = {};

function describeZod(zodType, path) {
  if (!zodType || !zodType._def) return typeof zodType;
  const def = zodType._def;
  const typeName = def.typeName;
  if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    return { type: typeName, inner: describeZod(def.innerType, path) };
  }
  if (typeName === 'ZodDefault') {
    // The default value itself, not just the fact that there is one: a column
    // defaulting to 0 on one engine and null on the other is exactly the kind
    // of divergence this test exists to catch.
    let value;
    try { value = JSON.stringify(def.defaultValue()); } catch (err) { value = 'threw: ' + err.message; }
    return { type: 'ZodDefault', value: value, inner: describeZod(def.innerType, path) };
  }
  if (typeName === 'ZodEffects') {
    return { type: 'ZodEffects', effectType: def.effect && def.effect.type, inner: describeZod(def.schema, path) };
  }
  if (typeName === 'ZodPipeline') {
    return { type: 'ZodPipeline', in: describeZod(def.in, path + '|in'), out: describeZod(def.out, path + '|out') };
  }
  if (typeName === 'ZodArray') {
    return { type: 'ZodArray', element: describeZod(def.type, path + '[]') };
  }
  if (typeName === 'ZodRecord') {
    return { type: 'ZodRecord', key: describeZod(def.keyType, path + '{k}'), value: describeZod(def.valueType, path + '{v}') };
  }
  if (typeName === 'ZodObject') {
    const shape = {};
    for (const entry of Object.entries(zodType.shape)) {
      shape[entry[0]] = describeZod(entry[1], path + '.' + entry[0]);
    }
    return { type: 'ZodObject', shape: shape };
  }
  if (typeName === 'ZodUnion') {
    return { type: 'ZodUnion', options: def.options.map((o, i) => describeZod(o, path + '|' + i)) };
  }
  if (typeName === 'ZodEnum') {
    return { type: 'ZodEnum', values: def.values };
  }
  if (typeName === 'ZodLiteral') {
    return { type: 'ZodLiteral', value: JSON.stringify(def.value) };
  }
  if (typeName === 'ZodNumber') {
    const checks = [];
    for (const check of def.checks || []) {
      if ((check.kind === 'min' || check.kind === 'max') && WIDTH_BOUNDS.indexOf(check.value) !== -1) {
        bounds[path] = bounds[path] || {};
        bounds[path][check.kind] = check.value;
        continue;
      }
      checks.push(JSON.stringify(check));
    }
    return { type: 'ZodNumber', checks: checks };
  }
  if (def.checks) {
    return { type: typeName, checks: def.checks.map((c) => JSON.stringify(c)) };
  }
  return { type: typeName };
}

const shapes = {};
for (const entry of Object.entries(schema)) {
  const key = entry[0];
  const value = entry[1];
  if (isTable(value)) {
    shapes['table:' + key] = describeZod(createInsertSchema(value), 'table:' + key);
  } else if (value instanceof z.ZodType || (value && value._def)) {
    shapes['schema:' + key] = describeZod(value, 'schema:' + key);
  }
}
console.log(JSON.stringify({ shapes: shapes, bounds: bounds }));
`;

function describeSchemas(extraArgs: string[]): { shapes: Record<string, unknown>; bounds: Record<string, { min?: number; max?: number }> } {
  const repoRoot = path.resolve(__dirname, "..");
  const output = execFileSync("npx", ["tsx", ...extraArgs, "-e", script], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
  return JSON.parse(output);
}

describe("Schema invariance across dialects (ADR-0004)", () => {
  const pg = describeSchemas([]);
  const sqlite = describeSchemas(["--tsconfig=tsconfig.sqlite.json"]);

  it("describes every table and exported schema under both dialects", () => {
    // A floor rather than an exact count, so adding a table does not fail the
    // test - but high enough that a script that silently produced nothing, or
    // stopped seeing tables, does.
    expect(Object.keys(pg.shapes).length).toBeGreaterThanOrEqual(41);
    expect(Object.keys(pg.shapes)).toEqual(Object.keys(sqlite.shapes));
  });

  it("produces identical Zod definitions for every table and exported schema", () => {
    for (const [name, pgDef] of Object.entries(pg.shapes)) {
      expect(sqlite.shapes[name], `Schema mismatch for ${name}`).toEqual(pgDef);
    }
  });

  it("keeps the Postgres integer range - the one the client bundles - no wider than SQLite's", () => {
    expect(Object.keys(pg.bounds).length).toBeGreaterThan(0);
    expect(Object.keys(pg.bounds).sort()).toEqual(Object.keys(sqlite.bounds).sort());

    for (const [field, pgBound] of Object.entries(pg.bounds)) {
      const sqliteBound = sqlite.bounds[field];
      expect(WIDTH_BOUNDS, `Unexpected Postgres bound on ${field}`).toContain(pgBound.min);
      expect(WIDTH_BOUNDS, `Unexpected Postgres bound on ${field}`).toContain(pgBound.max);
      expect(pgBound.min, `${field}: Postgres accepts values below SQLite's floor`)
        .toBeGreaterThanOrEqual(sqliteBound.min!);
      expect(pgBound.max, `${field}: Postgres accepts values above SQLite's ceiling`)
        .toBeLessThanOrEqual(sqliteBound.max!);
    }
  });
});
