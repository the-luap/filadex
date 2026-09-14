import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import pl from "../../client/src/i18n/locales/pl";
import de from "../../client/src/i18n/locales/de";
import { shouldPromptBarcodeOverwrite, resolveBarcodeUpdate } from "../../client/src/components/filament-modal";

describe("GTIN overwrite confirmation translations and keys", () => {
  it("defines all required overwrite barcode keys across locales", () => {
    const requiredKeys = [
      "overwriteBarcodeTitle",
      "overwriteBarcodeDescription",
      "keepExistingBarcode",
      "overwriteWithBarcode",
      "selectGtin",
    ];

    for (const key of requiredKeys) {
      expect((en as any).scanner[key]).toBeTruthy();
      expect((pl as any).scanner[key]).toBeTruthy();
      expect((de as any).scanner[key]).toBeTruthy();
    }
  });

  it("formats prompt description with current and incoming barcodes", () => {
    const descTemplate = (en as any).scanner.overwriteBarcodeDescription;
    const formatted = descTemplate
      .replace("{{current}}", "1112223334445")
      .replace("{{incoming}}", "6975337039999");

    expect(formatted).toContain("1112223334445");
    expect(formatted).toContain("6975337039999");
  });
});

describe("shouldPromptBarcodeOverwrite", () => {
  it("returns false when barcode field is empty", () => {
    expect(shouldPromptBarcodeOverwrite("", "6975337039999", ["6975337039999"])).toBe(false);
    expect(shouldPromptBarcodeOverwrite(null, "6975337039999", ["6975337039999"])).toBe(false);
    expect(shouldPromptBarcodeOverwrite(undefined, "6975337039999")).toBe(false);
  });

  it("returns false when incoming barcode is empty", () => {
    expect(shouldPromptBarcodeOverwrite("1112223334445", "", [])).toBe(false);
    expect(shouldPromptBarcodeOverwrite("1112223334445", null, [])).toBe(false);
  });

  it("returns false when current barcode matches incoming GTIN", () => {
    expect(shouldPromptBarcodeOverwrite("6975337039999", "6975337039999", ["6975337039999"])).toBe(false);
    expect(shouldPromptBarcodeOverwrite("  6975337039999  ", "6975337039999")).toBe(false);
  });

  it("returns false when current and incoming barcodes differ only by leading zeros", () => {
    expect(shouldPromptBarcodeOverwrite("684620401324", "0684620401324", ["0684620401324"])).toBe(false);
    expect(shouldPromptBarcodeOverwrite("0684620401324", "684620401324", ["684620401324"])).toBe(false);
  });

  it("returns true when current barcode is different and not in catalog item GTINs", () => {
    expect(shouldPromptBarcodeOverwrite("1112223334445", "6975337039999", ["6975337039999"])).toBe(true);
    expect(shouldPromptBarcodeOverwrite("1112223334445", "6975337039999", ["6975337039999", "6975337038888"])).toBe(true);
  });

  it("returns false when current barcode is one of multiple merged GTINs on the catalog item (e.g. scanned barcode)", () => {
    // User scanned barcode B ("590222"), catalog item has merged GTINs [A, B], chosen GTIN defaults to A ("590111")
    expect(
      shouldPromptBarcodeOverwrite("590222", "590111", ["590111", "590222"])
    ).toBe(false);

    // With whitespace
    expect(
      shouldPromptBarcodeOverwrite("  590222  ", "590111", ["590111", "590222"])
    ).toBe(false);

    // With leading zeros
    expect(
      shouldPromptBarcodeOverwrite("684620401324", "590111", ["0684620401324", "590111"])
    ).toBe(false);
  });
});

describe("resolveBarcodeUpdate", () => {
  const multiGtins = ["590111", "590222"];

  it("updates barcode when form is empty (card selection)", () => {
    expect(resolveBarcodeUpdate("", "590111", multiGtins, false)).toEqual({
      type: "update",
      barcode: "590111",
    });
  });

  it("updates barcode when form is empty and specific chip is selected", () => {
    expect(resolveBarcodeUpdate("", "590222", multiGtins, true)).toEqual({
      type: "update",
      barcode: "590222",
    });
  });

  it("does not prompt to replace a barcode with itself on explicit chip click", () => {
    // Current is 111, chip clicked is 111
    expect(resolveBarcodeUpdate("111", "111", ["222"], true)).toEqual({
      type: "none",
    });
  });

  it("does not prompt to replace a barcode with itself on leading zero differences", () => {
    expect(resolveBarcodeUpdate("684620401324", "684620401324", ["0684620401324"], true)).toEqual({
      type: "none",
    });
    expect(resolveBarcodeUpdate("684620401324", "0684620401324", ["0684620401324"], true)).toEqual({
      type: "none",
    });
    expect(resolveBarcodeUpdate("684620401324", "0684620401324", ["0684620401324"], false)).toEqual({
      type: "none",
    });
  });

  it("prompts overwrite when form has unrelated barcode and card is selected", () => {
    expect(resolveBarcodeUpdate("1112223334445", "590111", multiGtins, false)).toEqual({
      type: "prompt",
      currentBarcode: "1112223334445",
      incomingBarcode: "590111",
    });
  });

  it("prompts overwrite when form has unrelated barcode and specific chip is clicked", () => {
    expect(resolveBarcodeUpdate("1112223334445", "590222", multiGtins, true)).toEqual({
      type: "prompt",
      currentBarcode: "1112223334445",
      incomingBarcode: "590222",
    });
  });

  it("preserves existing barcode when user scanned a merged barcode and card is selected", () => {
    // Form already has 590222, default card choice is 590111 -> action is "none" (preserve 590222)
    expect(resolveBarcodeUpdate("590222", "590111", multiGtins, false)).toEqual({
      type: "none",
    });
  });

  it("preserves existing barcode when user scanned a merged barcode with leading zero difference", () => {
    expect(resolveBarcodeUpdate("684620401324", "590111", ["0684620401324", "590111"], false)).toEqual({
      type: "none",
    });
  });

  it("explicitly switches barcode when user clicks a specific GTIN chip even if form has another merged GTIN", () => {
    // Form has 590111, but user explicitly clicked 590222 chip -> updates to 590222 without prompt!
    expect(resolveBarcodeUpdate("590111", "590222", multiGtins, true)).toEqual({
      type: "update",
      barcode: "590222",
    });
  });
});

