import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import pl from "../../client/src/i18n/locales/pl";
import de from "../../client/src/i18n/locales/de";

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
