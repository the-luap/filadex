import { describe, expect, it } from "vitest";
import { processBambuLabBarcode, processBambuLabQRCode, processScanResult } from "../../client/src/components/qr-scanner";

describe("qr-scanner Bambu Lab parsing", () => {
  it("does not append manufacturer to filament name in processBambuLabBarcode", () => {
    const result = processBambuLabBarcode("BBL-PLA01-000000");
    expect(result.manufacturer).toBe("Bambu Lab");
    expect(result.name).not.toContain("Bambu Lab");
    expect(result.name).toBe("PLA Black");
  });

  it("extracts CF material variants and colors in barcode correctly without false 01 serial matches", () => {
    const cfResult = processBambuLabBarcode("BBL-PLACF-BK-123456");
    expect(cfResult.material).toBe("pla-cf");
    expect(cfResult.colorName).toBe("Black");
    expect(cfResult.colorCode).toBe("#000000");
    expect(cfResult.name).toBe("PLA-CF Black");
    expect(cfResult.manufacturer).toBe("Bambu Lab");

    const serialResult = processBambuLabBarcode("BBL-PLA-901234");
    expect(serialResult.material).toBe("pla");
    expect(serialResult.colorName).toBeUndefined();
    expect(serialResult.colorCode).toBeUndefined();
  });

  it("correctly identifies full-word colors like BLACK and IVORY without substring hits", () => {
    const blackResult = processBambuLabBarcode("BBL-PLA-BLACK");
    expect(blackResult.colorName).toBe("Black");
    expect(blackResult.colorCode).toBe("#000000");
    expect(blackResult.name).toBe("PLA Black");

    const ivoryResult = processBambuLabBarcode("BBL-PLA-IVORY");
    expect(ivoryResult.colorName).toBe("Ivory");
    expect(ivoryResult.name).toBe("PLA Ivory");

    const blueResult = processBambuLabBarcode("BBL-PLA-BL");
    expect(blueResult.colorName).toBe("Blue");
    expect(blueResult.colorCode).toBe("#0A2989");

    const orangeResult = processBambuLabBarcode("BBL-PLA-OR");
    expect(orangeResult.colorName).toBe("Orange");
    expect(orangeResult.colorCode).toBe("#FA6607");
  });

  it("parses PCTG QR codes correctly as PCTG with correct print temp and name", () => {
    const pctgResult = processBambuLabQRCode("[BBL]PCTG Black 1KG");
    expect(pctgResult.material).toBe("pctg");
    expect(pctgResult.name).toBe("PCTG Black");
    expect(pctgResult.printTemp).toBe("250-270");
    expect(pctgResult.colorName).toBe("Black");
    expect(pctgResult.colorCode).toBe("#000000");
  });

  it("preserves color modifiers like 'Matte' in processBambuLabQRCode and does not append manufacturer", () => {
    const result = processBambuLabQRCode("[BBL]PLA Matte Black 1KG");
    expect(result.manufacturer).toBe("Bambu Lab");
    expect(result.name).not.toContain("Bambu Lab");
    expect(result.colorName).toBe("Matte Black");
    expect(result.name).toBe("PLA Matte Black");
  });

  it("detects CF and HF material variants in QR code", () => {
    const cfResult = processBambuLabQRCode("[BBL]PLA-CF Lava Orange 1KG");
    expect(cfResult.material).toBe("pla-cf");
    expect(cfResult.colorName).toBe("Lava Orange");
    expect(cfResult.name).toBe("PLA-CF Lava Orange");
    expect(cfResult.manufacturer).toBe("Bambu Lab");

    const hfResult = processBambuLabQRCode("[BBL]PLA-HF White 1KG");
    expect(hfResult.material).toBe("pla-hf");
    expect(hfResult.colorName).toBe("White");
    expect(hfResult.name).toBe("PLA-HF White");
  });

  it("extracts unrecognized colors for downstream custom color fallback", () => {
    const result = processBambuLabQRCode("[BBL]PETG Translucent Teal 1KG");
    expect(result.material).toBe("petg");
    expect(result.colorName).toBe("Translucent Teal");
    expect(result.name).toBe("PETG Translucent Teal");
    expect(result.manufacturer).toBe("Bambu Lab");

    const pinkResult = processBambuLabQRCode("[BBL]PLA Matte Sakura Pink 1KG");
    expect(pinkResult.colorName).toBe("Matte Sakura Pink");
    expect(pinkResult.colorCode).toBe("#FFC0CB");
    expect(pinkResult.name).toBe("PLA Matte Sakura Pink");
  });

  it("sets manufacturer separately from name in processScanResult", () => {
    const result = processScanResult("[BBL]PETG White 1KG");
    expect(result).not.toBeNull();
    expect(result?.manufacturer).toBe("Bambu Lab");
    expect(result?.name).not.toContain("Bambu Lab");
    expect(result?.name).toBe("PETG White");
  });
});
