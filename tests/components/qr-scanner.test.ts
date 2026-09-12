import { describe, expect, it } from "vitest";
import { processBambuLabBarcode, processBambuLabQRCode, processScanResult } from "../../client/src/components/qr-scanner";

describe("qr-scanner Bambu Lab parsing", () => {
  it("does not append manufacturer to filament name in processBambuLabBarcode", () => {
    const result = processBambuLabBarcode("BBL-PLA01-000000");
    expect(result.manufacturer).toBe("Bambu Lab");
    expect(result.name).not.toContain("Bambu Lab");
    expect(result.name).toBe("PLA Black");
  });

  it("does not append manufacturer to filament name in processBambuLabQRCode", () => {
    const result = processBambuLabQRCode("[BBL]PLA Matte Black 1KG");
    expect(result.manufacturer).toBe("Bambu Lab");
    expect(result.name).not.toContain("Bambu Lab");
    expect(result.name).toBe("PLA Black");
  });

  it("sets manufacturer separately from name in processScanResult", () => {
    const result = processScanResult("[BBL]PETG White 1KG");
    expect(result).not.toBeNull();
    expect(result?.manufacturer).toBe("Bambu Lab");
    expect(result?.name).not.toContain("Bambu Lab");
    expect(result?.name).toBe("PETG White");
  });
});
