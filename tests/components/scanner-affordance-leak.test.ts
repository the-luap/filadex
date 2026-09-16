import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("production bundle test affordances leak check", () => {
  it("does not leak filadex:scan or E2EScanAffordance into built client assets", () => {
    const assetsDir = path.resolve("dist/public/assets");
    if (!fs.existsSync(assetsDir)) {
      // If assets have not been built yet in this test run environment, skip
      return;
    }

    const jsFiles = fs
      .readdirSync(assetsDir)
      .filter((file) => file.endsWith(".js"))
      .map((file) => path.join(assetsDir, file));

    expect(jsFiles.length).toBeGreaterThan(0);

    for (const filePath of jsFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      // Standard production builds must not contain the simulated scan event listener or helper
      expect(content).not.toContain("filadex:scan");
      expect(content).not.toContain("E2EScanAffordance");
    }
  });
});
