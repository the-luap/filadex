import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import en from "../../client/src/i18n/locales/en";
import de from "../../client/src/i18n/locales/de";
import pl from "../../client/src/i18n/locales/pl";

function walkSourceFiles(dir: string): string[] {
  let files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "locales") {
        files = files.concat(walkSourceFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveKey(obj: any, keyPath: string): any {
  return keyPath.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), obj);
}

describe("source code translation key completeness", () => {
  const clientSrc = path.resolve(__dirname, "../../client/src");
  const sourceFiles = walkSourceFiles(clientSrc);
  const keyRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
  const staticKeys = new Set<string>();

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    while ((match = keyRegex.exec(content)) !== null) {
      staticKeys.add(match[1]);
    }
  }

  const locales = [
    ["en", en],
    ["de", de],
    ["pl", pl],
  ] as const;

  it("finds static t('...') literals in client/src", () => {
    expect(staticKeys.size).toBeGreaterThan(100);
  });

  it.each(locales)("resolves all static t('...') keys in %s", (localeName, localeObj) => {
    const missing: string[] = [];
    for (const key of staticKeys) {
      const value = resolveKey(localeObj, key);
      if (typeof value !== "string" || value.trim() === "") {
        missing.push(key);
      }
    }
    expect(
      missing,
      `The following translation keys are referenced via t('...') in client/src but missing or empty in ${localeName}.ts:\n${missing.join(
        "\n"
      )}`
    ).toEqual([]);
  });
});
