import { describe, expect, it } from "vitest";

import en from "../../client/src/i18n/locales/en";
import de from "../../client/src/i18n/locales/de";
import pl from "../../client/src/i18n/locales/pl";

type Tree = { [key: string]: string | Tree };

function keyPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? keyPaths(value, path)
      : [path];
  });
}

const reference = keyPaths(en as Tree).sort();

describe("translation locale parity", () => {
  it.each([
    ["de", de],
    ["pl", pl],
  ])("%s has exactly the same keys as en", (_name, locale) => {
    expect(keyPaths(locale as Tree).sort()).toEqual(reference);
  });
});
