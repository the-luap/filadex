import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

describe("SQLite starter data re-seed prevention on reboot", () => {
  it("does not re-seed starter data after container restart even if admin emptied starter tables", async () => {
    const tmpDbPath = path.resolve("/tmp", `test_seed_restart_${Date.now()}.db`);
    try {
      // 1. Run migrations
      execSync(`DATABASE_URL="file:${tmpDbPath}" npm run db:migrate:sqlite`, {
        cwd: process.cwd(),
        stdio: "pipe",
      });

      // 2. Initial seed (first container boot with INIT_SAMPLE_DATA=true)
      const seed1Output = execSync(`DATABASE_URL="file:${tmpDbPath}" npm run db:init:sqlite`, {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      });
      expect(seed1Output).toContain("Basic starter selection options inserted");

      // Verify colors count is 8
      const client = createClient({ url: `file:${tmpDbPath}` });
      const colorsBefore = await client.execute("SELECT count(*) as count FROM colors;");
      expect(Number(colorsBefore.rows[0].count)).toBe(8);

      // 3. Second boot without changes: should skip starter initialization
      const seed2Output = execSync(`DATABASE_URL="file:${tmpDbPath}" npm run db:init:sqlite`, {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      });
      expect(seed2Output).not.toContain("Basic starter selection options inserted");

      // Colors should still be 8 (no duplicates)
      const colorsAfterSecondBoot = await client.execute("SELECT count(*) as count FROM colors;");
      expect(Number(colorsAfterSecondBoot.rows[0].count)).toBe(8);

      // 4. Admin deletes all manufacturers, materials, colors, storage locations, and system_settings
      await client.execute("DELETE FROM manufacturers;");
      await client.execute("DELETE FROM materials;");
      await client.execute("DELETE FROM colors;");
      await client.execute("DELETE FROM storage_locations;");
      await client.execute("DELETE FROM system_settings;");

      const mfgCount = await client.execute("SELECT count(*) as count FROM manufacturers;");
      expect(Number(mfgCount.rows[0].count)).toBe(0);

      // 5. Third boot after admin deleted all data: MUST NOT reseed due to sequence generator check (Check 3)!
      const seed3Output = execSync(`DATABASE_URL="file:${tmpDbPath}" npm run db:init:sqlite`, {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      });
      expect(seed3Output).toContain("Sequence generator indicates starter data was previously seeded");
      expect(seed3Output).not.toContain("Adding starter selection options");

      // Counts must remain 0
      const mfgCountAfterReboot = await client.execute("SELECT count(*) as count FROM manufacturers;");
      expect(Number(mfgCountAfterReboot.rows[0].count)).toBe(0);
      const colorsCountAfterReboot = await client.execute("SELECT count(*) as count FROM colors;");
      expect(Number(colorsCountAfterReboot.rows[0].count)).toBe(0);

      client.close();
    } finally {
      if (fs.existsSync(tmpDbPath)) {
        fs.unlinkSync(tmpDbPath);
      }
      if (fs.existsSync(`${tmpDbPath}-wal`)) {
        fs.unlinkSync(`${tmpDbPath}-wal`);
      }
      if (fs.existsSync(`${tmpDbPath}-shm`)) {
        fs.unlinkSync(`${tmpDbPath}-shm`);
      }
    }
  });
});
