import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import de from "../../client/src/i18n/locales/de";
import pl from "../../client/src/i18n/locales/pl";

describe("collection scanner translations", () => {
  it("defines all required collection scanner keys across locales", () => {
    const requiredKeys = [
      "foundInCollection",
      "searchCommunityCatalogInstead",
      "multipleCollectionMatchesTitle",
      "multipleCollectionMatchesDescription",
      "overwriteSpecsTitle",
      "overwriteSpecsDescription",
      "updateBarcodeOnly",
      "overwriteSpecs",
      "spoolMatchedActionTitle",
      "spoolMatchedActionDescription",
      "viewInCollection",
      "addAnotherSpool",
    ];

    for (const key of requiredKeys) {
      expect((en as any).scanner[key]).toBeTruthy();
      expect((de as any).scanner[key]).toBeTruthy();
      expect((pl as any).scanner[key]).toBeTruthy();
    }
  });

  it("formats foundInCollection with name", () => {
    const template = (en as any).scanner.foundInCollection;
    expect(template.replace("{{name}}", "Prusament PLA")).toContain("Prusament PLA");
  });
});
