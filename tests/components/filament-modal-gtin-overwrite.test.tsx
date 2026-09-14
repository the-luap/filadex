import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import pl from "../../client/src/i18n/locales/pl";
import de from "../../client/src/i18n/locales/de";
import { shouldPromptBarcodeOverwrite } from "../../client/src/components/filament-modal";

describe("GTIN overwrite confirmation translations and keys", () => {
  it("defines all required overwrite barcode keys across locales", () => {
    const requiredKeys = [
      "overwriteBarcodeTitle",
      "overwriteBarcodeDescription",
      "keepExistingBarcode",
      "overwriteWithBarcode",
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
  });
});

