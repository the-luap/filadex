import { sql } from "drizzle-orm";
import { db, dialect } from "@db";
import { genericTerms } from "@shared/schema";
import { logger } from "./logger";

/**
 * The words similarity matching ignores when comparing catalog names, so that
 * "Bambu Lab" and "Sunlu Lab" are not treated as near-duplicates because they
 * share "Lab" (ADR-0009).
 */
export const DEFAULT_GENERIC_TERMS = [
  "lab", "labs", "filament", "filaments", "3d", "polymers",
  "material", "materials", "printing", "print", "studio", "maker",
];

/**
 * Puts the default terms in place on an install that has never had any.
 *
 * Runs at startup, like the default admin account, rather than only from the
 * seeder. The table is created empty by its migration and was previously filled
 * only by `scripts/seed.ts`, which runs on a fresh install and not on an
 * upgrade - so every existing install that upgraded had an empty list, and the
 * similarity prompt fired on exactly the words this list exists to suppress
 * (issue #37). Startup is the one path every install takes.
 *
 * An admin who deliberately empties the list keeps it empty: auto-increment ids
 * are never reused, so a surviving row or an advanced sequence means the table
 * was populated at some point and this does nothing.
 */
export async function ensureDefaultGenericTerms(): Promise<void> {
  try {
    const [{ maxId }] = await db
      .select({ maxId: sql<number>`coalesce(max(${genericTerms.id}), 0)` })
      .from(genericTerms);
    if (Number(maxId) > 0) {
      return;
    }

    if (await termsWereSeededBefore()) {
      return;
    }

    await db.insert(genericTerms)
      .values(DEFAULT_GENERIC_TERMS.map((word) => ({ word })))
      .onConflictDoNothing();
    logger.info(`Added ${DEFAULT_GENERIC_TERMS.length} default generic terms for similarity matching.`);
  } catch (error) {
    // Never block startup over reference data for one feature.
    logger.error("Could not ensure default generic terms:", error);
  }
}

/**
 * Whether the table has held rows before, read from the sequence generator.
 * Answers false when it cannot tell, so a fresh install still gets its
 * defaults; the caller has already established the table is empty.
 */
async function termsWereSeededBefore(): Promise<boolean> {
  try {
    if ((dialect as string) === "sqlite") {
      // sqlite_sequence only carries a row once an AUTOINCREMENT table has had one.
      const rows: any = await (db as any).all(
        sql`SELECT seq FROM sqlite_sequence WHERE name = 'generic_terms'`,
      );
      return Array.isArray(rows) && rows.length > 0 && Number(rows[0]?.seq) > 0;
    }

    const result: any = await (db as any).execute(
      sql`SELECT last_value, is_called FROM generic_terms_id_seq`,
    );
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    return rows.length > 0 && Boolean(rows[0]?.is_called);
  } catch (error) {
    logger.warn("Could not inspect the generic_terms sequence; treating the table as never seeded:", error);
    return false;
  }
}
