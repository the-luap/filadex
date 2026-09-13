/**
 * The default stop-word list for similarity matching.
 *
 * It used to be written only by scripts/seed.ts, which runs on a fresh install
 * and not on an upgrade - so every upgraded install had an empty list and the
 * similarity prompt fired on the very words it exists to suppress (#37).
 */
import { describe, expect, it } from "vitest";
import { db } from "../helpers/db";
import { genericTerms } from "../../shared/schema";
import { DEFAULT_GENERIC_TERMS, ensureDefaultGenericTerms } from "../../server/utils/generic-terms";

const words = async () => (await db.select().from(genericTerms)).map((t) => t.word).sort();

describe("ensureDefaultGenericTerms", () => {
  it("fills an install that has never had any - the upgrade case", async () => {
    expect(await words()).toEqual([]);

    await ensureDefaultGenericTerms();

    expect(await words()).toEqual([...DEFAULT_GENERIC_TERMS].sort());
  });

  it("leaves an already-populated list alone", async () => {
    await db.insert(genericTerms).values({ word: "only-mine" });

    await ensureDefaultGenericTerms();

    expect(await words()).toEqual(["only-mine"]);
  });

  it("does not undo an admin who deleted every term", async () => {
    await ensureDefaultGenericTerms();
    await db.delete(genericTerms);

    // What the next restart does.
    await ensureDefaultGenericTerms();

    expect(await words()).toEqual([]);
  });

  it("is a no-op when run again, so every boot does not duplicate the list", async () => {
    await ensureDefaultGenericTerms();
    await ensureDefaultGenericTerms();
    await ensureDefaultGenericTerms();

    expect(await words()).toEqual([...DEFAULT_GENERIC_TERMS].sort());
  });
});
