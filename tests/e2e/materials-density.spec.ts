import { test, expect } from "@playwright/test";
import { signIn, openMaterialsSettings, densityOf, densityInput } from "./helpers";

/**
 * The defect this pins (fixed in #10, `f33daca`, shipped without coverage):
 *
 * A `type="number"` input holding text the browser cannot parse - "1.24e" -
 * reports `value` as `""`. The blur handler read that as a deliberate clear and
 * PUT `density: null`, wiping a stored density on the *success* path: no error,
 * no toast, nothing to undo.
 *
 * It is only reproducible in a real browser. jsdom does not implement
 * `validity.badInput` for number inputs and returns the raw string, so a
 * component test would have passed against the broken code - which is the
 * reason this suite exists at all rather than a jsdom one.
 */
test.describe("density on a catalog material", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await openMaterialsSettings(page);
  });

  test("text the browser cannot parse does not wipe the stored density", async ({ page }) => {
    const before = await densityOf(page, "PLA");
    expect(before, "the demo fixture seeds PLA with a density").not.toBeNull();

    const input = densityInput(page, "PLA");
    await input.click();
    // Typed, not `fill`: appending an exponent is what puts a number input into
    // badInput, and fill() would set the value directly and bypass it.
    await input.press("End");
    await input.type("e");
    await input.blur();

    // The field returns to the stored value rather than staying empty...
    await expect(input).toHaveValue(before!);
    // ...and, the part that actually matters, nothing was written.
    expect(await densityOf(page, "PLA")).toBe(before);

    await openMaterialsSettings(page);
    await expect(densityInput(page, "PLA")).toHaveValue(before!);
  });

  test("a real edit still saves", async ({ page }) => {
    const input = densityInput(page, "PLA");
    await input.fill("1.30");
    await input.blur();

    await expect.poll(() => densityOf(page, "PLA")).toBe("1.30");
  });

  test("clearing the field still clears the density", async ({ page }) => {
    const input = densityInput(page, "PETG");
    await input.fill("");
    await input.blur();

    // Distinguishing this from the badInput case above is the whole point of
    // the fix: an empty field is a deliberate clear and must still work.
    await expect.poll(() => densityOf(page, "PETG")).toBeNull();
  });
});
