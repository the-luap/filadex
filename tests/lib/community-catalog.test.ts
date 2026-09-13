import { describe, expect, it } from "vitest";
import { formatCommunityCatalogFilamentName, hasWord } from "../../client/src/lib/community-catalog";

describe("community-catalog name formatting", () => {
  describe("hasWord", () => {
    it("matches exact words and phrases case-insensitively", () => {
      expect(hasWord("PolyTerra PLA Sapphire Blue", "PLA")).toBe(true);
      expect(hasWord("PolyTerra pla Sapphire Blue", "PLA")).toBe(true);
      expect(hasWord("PLA Galaxy Black", "Galaxy Black")).toBe(true);
    });

    it("does not match short words inside other words", () => {
      expect(hasWord("Sparkle Blue", "PA")).toBe(false);
      expect(hasWord("Space Grey", "PA")).toBe(false);
      expect(hasWord("Transparent White", "PA")).toBe(false);
      expect(hasWord("Opaque Yellow", "PA")).toBe(false);
      expect(hasWord("Copper Red", "PP")).toBe(false);
      expect(hasWord("Shredder Green", "Red")).toBe(false);
      expect(hasWord("Titanium Grey", "Tan")).toBe(false);
    });

    it("handles empty or null inputs safely", () => {
      expect(hasWord("", "PLA")).toBe(false);
      expect(hasWord("PLA", "")).toBe(false);
    });
  });

  describe("formatCommunityCatalogFilamentName", () => {
    it("strips manufacturer prefix from product name when on a delimiter boundary", () => {
      const formatted = formatCommunityCatalogFilamentName({
        manufacturer: "Polymaker",
        name: "Polymaker PolyTerra PLA Sapphire Blue",
        material: "PLA",
        colorName: "Sapphire Blue",
      });
      expect(formatted).toBe("PolyTerra PLA Sapphire Blue");

      const formattedWithHyphen = formatCommunityCatalogFilamentName({
        manufacturer: "Polymaker",
        name: "Polymaker - PolyTerra PLA Sapphire Blue",
        material: "PLA",
        colorName: "Sapphire Blue",
      });
      expect(formattedWithHyphen).toBe("PolyTerra PLA Sapphire Blue");
    });

    it("does not strip manufacturer prefix when it is a substring of another word", () => {
      const formatted = formatCommunityCatalogFilamentName({
        manufacturer: "Poly",
        name: "PolyTerra PLA Sapphire Blue",
        material: "PLA",
        colorName: "Sapphire Blue",
      });
      expect(formatted).toBe("PolyTerra PLA Sapphire Blue");
    });

    it("prepends material when material code is inside other words but not a standalone word", () => {
      // "PA" inside "Space" and "Sparkle"
      const formattedSpace = formatCommunityCatalogFilamentName({
        manufacturer: "Polymaker",
        name: "Space Grey",
        material: "PA",
        colorName: "Space Grey",
      });
      expect(formattedSpace).toBe("PA Space Grey");

      const formattedSparkle = formatCommunityCatalogFilamentName({
        manufacturer: "Polymaker",
        name: "Sparkle Blue",
        material: "PA",
        colorName: "Sparkle Blue",
      });
      expect(formattedSparkle).toBe("PA Sparkle Blue");

      // "PP" inside "Copper"
      const formattedPP = formatCommunityCatalogFilamentName({
        manufacturer: "Prusament",
        name: "Copper",
        material: "PP",
        colorName: "Copper",
      });
      expect(formattedPP).toBe("PP Copper");
    });

    it("does not duplicate material if already present as a standalone word", () => {
      const formatted = formatCommunityCatalogFilamentName({
        manufacturer: "Prusament",
        name: "PLA Galaxy Black",
        material: "PLA",
        colorName: "Galaxy Black",
      });
      expect(formatted).toBe("PLA Galaxy Black");
    });

    it("appends colorName when color appears inside other words but not as a standalone word", () => {
      // "Red" inside "Shredder"
      const formattedRed = formatCommunityCatalogFilamentName({
        manufacturer: "Generic",
        name: "Shredder",
        material: "PLA",
        colorName: "Red",
      });
      expect(formattedRed).toBe("PLA Shredder Red");

      // "Tan" inside "Titanium"
      const formattedTan = formatCommunityCatalogFilamentName({
        manufacturer: "Generic",
        name: "Titanium",
        material: "PLA",
        colorName: "Tan",
      });
      expect(formattedTan).toBe("PLA Titanium Tan");
    });

    it("does not duplicate colorName if already present as a word or phrase", () => {
      const formatted = formatCommunityCatalogFilamentName({
        manufacturer: "Prusament",
        name: "Galaxy Black",
        material: "PLA",
        colorName: "Galaxy Black",
      });
      expect(formatted).toBe("PLA Galaxy Black");

      const formattedPartial = formatCommunityCatalogFilamentName({
        manufacturer: "Prusament",
        name: "Galaxy Black",
        material: "PLA",
        colorName: "Black",
      });
      expect(formattedPartial).toBe("PLA Galaxy Black");
    });

    it("handles minimal or missing input fields gracefully", () => {
      expect(formatCommunityCatalogFilamentName({})).toBe("");
      expect(formatCommunityCatalogFilamentName({ material: "PLA" })).toBe("PLA");
      expect(formatCommunityCatalogFilamentName({ material: "PLA", colorName: "Black" })).toBe("PLA Black");
      expect(formatCommunityCatalogFilamentName({ name: "Basic Spool" })).toBe("Basic Spool");
    });
  });
});
