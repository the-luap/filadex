import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

describe("SQLite migration 0006 deduplication", () => {
  it("deduplicates case-variant manufacturers and applies partial unique indexes cleanly", async () => {
    const client = createClient({ url: "file::memory:" });

    // 1. Set up pre-0006 schema
    await client.execute(`
      CREATE TABLE \`users\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`username\` text NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE \`manufacturers\` (
        \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        \`name\` text NOT NULL,
        \`sort_order\` integer DEFAULT 999,
        \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );
    `);
    await client.execute(`
      CREATE UNIQUE INDEX \`manufacturers_name_key\` ON \`manufacturers\` (\`name\`);
    `);

    // 2. Insert case-variant duplicate manufacturers (allowed by exact-match pre-0006 index)
    await client.execute("INSERT INTO `manufacturers` (`name`, `sort_order`) VALUES ('Prusa', 1);");
    await client.execute("INSERT INTO `manufacturers` (`name`, `sort_order`) VALUES ('prusa', 2);");

    // Verify both exist before migration
    const beforeRows = await client.execute("SELECT id, name FROM `manufacturers` ORDER BY id;");
    expect(beforeRows.rows).toHaveLength(2);

    // 3. Read and execute migration 0006 statements
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "migrations/sqlite/0006_nappy_marvex.sql"),
      "utf8"
    );
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await client.execute(stmt);
    }

    // 4. Verify deduplication kept the canonical (earliest id) row
    const afterRows = await client.execute("SELECT id, name, user_id FROM `manufacturers` ORDER BY id;");
    expect(afterRows.rows).toHaveLength(1);
    expect(afterRows.rows[0].name).toBe("Prusa");
    expect(afterRows.rows[0].user_id).toBeNull();

    // 5. Verify case-insensitive unique index on global scope rejects duplicates
    await expect(
      client.execute("INSERT INTO `manufacturers` (`name`, `user_id`) VALUES ('prusa', NULL);")
    ).rejects.toThrow(/UNIQUE constraint failed/i);

    // 6. Verify user-scoped insert with same name succeeds
    await client.execute("INSERT INTO `users` (`id`, `username`) VALUES (1, 'alice');");
    await client.execute("INSERT INTO `manufacturers` (`name`, `user_id`) VALUES ('prusa', 1);");
    const userScopedRows = await client.execute("SELECT id, name, user_id FROM `manufacturers` WHERE user_id = 1;");
    expect(userScopedRows.rows).toHaveLength(1);
    expect(userScopedRows.rows[0].name).toBe("prusa");

    client.close();
  });
});
