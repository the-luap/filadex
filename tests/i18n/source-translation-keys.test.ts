import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { catalogRequestEntityTypes } from "@shared/schema";
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

function findDeadTranslationFallbacks(content: string): { line: number; text: string }[] {
  const deadFallbacks: { line: number; text: string }[] = [];
  let line = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
      continue;
    }
    if (
      content[i] === "t" &&
      (i === 0 || !/[a-zA-Z0-9_$]/.test(content[i - 1])) &&
      content[i + 1] === "("
    ) {
      const startLine = line;
      const startIndex = i;
      let k = i + 2;
      let depth = 1;
      let inQuote: string | null = null;
      let escaped = false;
      while (k < content.length && depth > 0) {
        const char = content[k];
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (inQuote) {
          if (char === inQuote) inQuote = null;
        } else if (char === "'" || char === '"' || char === "`") {
          inQuote = char;
        } else if (char === "(") {
          depth++;
        } else if (char === ")") {
          depth--;
        }
        k++;
      }
      if (depth === 0) {
        let j = k;
        while (j < content.length && /\s/.test(content[j])) j++;
        if (
          (content[j] === "|" && content[j + 1] === "|") ||
          (content[j] === "?" && content[j + 1] === "?")
        ) {
          const snippet = content.slice(startIndex, j + 2).replace(/\s+/g, " ");
          deadFallbacks.push({ line: startLine, text: snippet });
        }
      }
    }
  }
  return deadFallbacks;
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

  it.each(locales)(
    "resolves settings.${entityType}s.title in %s for all catalogRequestEntityTypes",
    (localeName, localeObj) => {
      const missing: string[] = [];
      for (const entityType of catalogRequestEntityTypes) {
        const key = `settings.${entityType}s.title`;
        const value = resolveKey(localeObj, key);
        if (typeof value !== "string" || value.trim() === "") {
          missing.push(key);
        }
      }
      expect(
        missing,
        `The following catalog request entity type titles are missing or empty in ${localeName}.ts:\n${missing.join(
          "\n"
        )}`
      ).toEqual([]);
    }
  );

  it("does not use dead || or ?? fallbacks after t(...) in client/src", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const relativePath = path.relative(path.resolve(__dirname, "../.."), file);
      const content = fs.readFileSync(file, "utf-8");
      const occurrences = findDeadTranslationFallbacks(content);
      for (const occ of occurrences) {
        violations.push(`${relativePath}:${occ.line} -> ${occ.text}`);
      }
    }
    expect(
      violations,
      `t(...) returns the key string on missing keys, which is truthy and non-null, so '||' and '??' fallback chains never trigger.\n` +
        `Ensure all required keys are defined in locales and remove the dead fallbacks:\n${violations.join(
          "\n"
        )}`
    ).toEqual([]);
  });
});

