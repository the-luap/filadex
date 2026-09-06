import { describe, expect, it } from "vitest";
import { normalizeSqliteUrl, sqliteFilePath } from "../server/sqlite-url";

describe("normalizeSqliteUrl", () => {
  it("rewrites the sqlite: scheme to file: for @libsql/client compatibility", () => {
    expect(normalizeSqliteUrl("sqlite:/data/filadex.db")).toBe("file:/data/filadex.db");
    expect(normalizeSqliteUrl("sqlite:///data/filadex.db")).toBe("file:///data/filadex.db");
  });

  it("leaves a file: URL untouched", () => {
    expect(normalizeSqliteUrl("file:/data/filadex.db")).toBe("file:/data/filadex.db");
    expect(normalizeSqliteUrl("file::memory:")).toBe("file::memory:");
  });
});

describe("sqliteFilePath", () => {
  it("returns the path both file: spellings name", () => {
    expect(sqliteFilePath("file:/data/filadex.db")).toBe("/data/filadex.db");
    expect(sqliteFilePath("file:///data/filadex.db")).toBe("/data/filadex.db");
  });

  it("keeps a relative path relative, so the caller can reject it", () => {
    expect(sqliteFilePath("file:./dev.db")).toBe("./dev.db");
    expect(sqliteFilePath("file:dev.db")).toBe("dev.db");
  });

  it("drops a query string", () => {
    expect(sqliteFilePath("file:/data/filadex.db?mode=ro")).toBe("/data/filadex.db");
  });

  it("returns null for URLs that name no file", () => {
    expect(sqliteFilePath("file::memory:")).toBeNull();
    expect(sqliteFilePath("file::memory:?cache=shared")).toBeNull();
    expect(sqliteFilePath("postgres://u:p@db:5432/filadex")).toBeNull();
  });
});
