import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerBackupRoutes } from "../../server/routes/backups";
import { initializeAdminUser } from "../../server/auth";
import { storage } from "../../server/storage";
import { createApp, loginAs, registerAndVerify } from "../helpers/app";
import { useTempBackupDir } from "../helpers/backup-dir";

let app: Express;
let adminCookie: string;
let userCookie: string;

const backupDir = useTempBackupDir();

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerBackupRoutes);
  await initializeAdminUser();
  adminCookie = await loginAs(app, "admin", "admin");
  userCookie = await registerAndVerify(app, {
    username: "bob",
    email: "bob@example.com",
    password: "bob-password-123",
  });
});

describe("GET /api/system/database", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/system/database");
    expect(res.status).toBe(401);
  });

  it("reports the current database dialect to authenticated users", async () => {
    const res = await request(app)
      .get("/api/system/database")
      .set("Cookie", userCookie);
    expect(res.status).toBe(200);
    expect(["postgres", "sqlite"]).toContain(res.body.dialect);
    expect(res.body.dialect).toBe(storage.getDialect());
  });
});

describe.skipIf(storage.getDialect() !== "postgres")("Backup routes on Postgres", () => {
  it("refuses all backup endpoints if dialect is Postgres", async () => {
    const listRes = await request(app)
      .get("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(listRes.status).toBe(400);
    expect(listRes.body.message).toMatch(/only supported on SQLite/i);

    const postRes = await request(app)
      .post("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(postRes.status).toBe(400);

    const streamRes = await request(app)
      .post("/api/admin/backups/stream")
      .set("Cookie", adminCookie);
    expect(streamRes.status).toBe(400);

    const settingsRes = await request(app)
      .get("/api/admin/backups/settings")
      .set("Cookie", adminCookie);
    expect(settingsRes.status).toBe(400);
  });
});

describe.skipIf(storage.getDialect() !== "sqlite")("Backup routes on SQLite", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/admin/backups");
    expect(res.status).toBe(401);
  });

  it("rejects authenticated non-admin users", async () => {
    const res = await request(app)
      .get("/api/admin/backups")
      .set("Cookie", userCookie);
    expect(res.status).toBe(403);
  });

  it("gets and updates backup settings", async () => {
    const initial = await request(app)
      .get("/api/admin/backups/settings")
      .set("Cookie", adminCookie);
    expect(initial.status).toBe(200);
    expect(initial.body.schedule).toBe("off");

    const update = await request(app)
      .put("/api/admin/backups/settings")
      .set("Cookie", adminCookie)
      .send({
        enabled: true,
        schedule: "daily",
        time: "03:30",
        retentionCount: 5,
      });
    expect(update.status).toBe(200);
    expect(update.body.enabled).toBe(true);
    expect(update.body.schedule).toBe("daily");
    expect(update.body.time).toBe("03:30");
    expect(update.body.retentionCount).toBe(5);

    const fetched = await request(app)
      .get("/api/admin/backups/settings")
      .set("Cookie", adminCookie);
    expect(fetched.status).toBe(200);
    expect(fetched.body.time).toBe("03:30");
  });

  it("creates a backup on disk, updates lastBackupAt, and prunes old backups", async () => {
    await storage.updateBackupSettings({ retentionCount: 2 });

    const create1 = await request(app)
      .post("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(create1.status).toBe(201);
    expect(create1.body.filename).toMatch(/^filadex-backup-.*\.db$/);
    expect(create1.body.size).toBeGreaterThan(0);

    const fullPath1 = path.join(backupDir(), create1.body.filename);
    expect(fs.existsSync(fullPath1)).toBe(true);

    const header = Buffer.alloc(16);
    const fd = fs.openSync(fullPath1, "r");
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    expect(header.toString("utf8", 0, 15)).toBe("SQLite format 3");

    // Wait 15ms so timestamp differences distinguish filenames
    await new Promise((resolve) => setTimeout(resolve, 15));
    const create2 = await request(app)
      .post("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(create2.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 15));
    const create3 = await request(app)
      .post("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(create3.status).toBe(201);

    // List backups: should have at most retentionCount (2)
    const list = await request(app)
      .get("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
    expect(list.body[0].filename).toBe(create3.body.filename);
    expect(list.body[1].filename).toBe(create2.body.filename);
  });

  it("rejects backup settings the scheduler and pruner cannot honour", async () => {
    const cases = [
      // retentionCount 0 makes pruneBackups slice(0) and delete every backup,
      // including the one the same request just wrote.
      { retentionCount: 0 },
      { retentionCount: -3 },
      { retentionCount: 2.5 },
      { schedule: "hourly" },
      { time: "25:00" },
      { time: "2:00" },
      { dayOfWeek: 0 },
      { dayOfWeek: 8 },
    ];

    for (const body of cases) {
      const res = await request(app)
        .put("/api/admin/backups/settings")
        .set("Cookie", adminCookie)
        .send(body);
      expect(res.status, `expected 400 for ${JSON.stringify(body)}`).toBe(400);
    }

    // The stored settings are untouched by the rejected requests.
    const settings = await request(app)
      .get("/api/admin/backups/settings")
      .set("Cookie", adminCookie);
    expect(settings.body.schedule).toBe("off");
  });

  it("neither lists nor prunes files it did not create", async () => {
    // BACKUP_DIR can be pointed at a directory holding an operator's own files -
    // /data, where the live database sits, is the obvious mistake.
    const foreign = path.join(backupDir(), "operator-copy.db");
    fs.writeFileSync(foreign, "not ours");

    await storage.updateBackupSettings({ retentionCount: 1 });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/admin/backups").set("Cookie", adminCookie);
      expect(res.status).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    const list = await request(app).get("/api/admin/backups").set("Cookie", adminCookie);
    expect(list.body.map((b: { filename: string }) => b.filename)).not.toContain("operator-copy.db");
    expect(list.body.length).toBe(1);
    expect(fs.existsSync(foreign)).toBe(true);
    expect(fs.readFileSync(foreign, "utf8")).toBe("not ours");
  });

  it("downloads a backup file and rejects path traversal attempts", async () => {
    const create = await request(app)
      .post("/api/admin/backups")
      .set("Cookie", adminCookie);
    expect(create.status).toBe(201);
    const filename = create.body.filename;

    const dl = await request(app)
      .get(`/api/admin/backups/${filename}`)
      .set("Cookie", adminCookie);
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain(filename);
    expect(dl.body.length).toBeGreaterThan(0);

    // Path traversal attempts
    const traversal1 = await request(app)
      .get("/api/admin/backups/..%2f..%2fpackage.json")
      .set("Cookie", adminCookie);
    expect(traversal1.status).toBe(400);

    const traversal2 = await request(app)
      .get("/api/admin/backups/%2e%2e%2fsecret.txt")
      .set("Cookie", adminCookie);
    expect(traversal2.status).toBe(400);

    // A name shaped like one of our snapshots, for a file that is not there.
    const notFound = await request(app)
      .get("/api/admin/backups/filadex-backup-nonexistent.db")
      .set("Cookie", adminCookie);
    expect(notFound.status).toBe(404);

    // A *.db in BACKUP_DIR that this application did not write is not a backup:
    // listBackupFiles already skips it, and the download route refuses it too,
    // so pointing BACKUP_DIR at /data cannot serve the live database.
    fs.writeFileSync(path.join(backupDir(), "filadex.db"), "live database");
    const unlisted = await request(app)
      .get("/api/admin/backups/filadex.db")
      .set("Cookie", adminCookie);
    expect(unlisted.status).toBe(400);
    expect(fs.readFileSync(path.join(backupDir(), "filadex.db"), "utf8")).toBe("live database");
  });

  it("streams a snapshot without leaving a persistent file", async () => {
    const res = await request(app)
      .post("/api/admin/backups/stream")
      .set("Cookie", adminCookie)
      .responseType("blob");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/x-sqlite3");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="filadex-backup-.*\.db"/);
    expect(res.body.length).toBeGreaterThan(0);

    const header = res.body.slice(0, 15).toString("utf8");
    expect(header).toBe("SQLite format 3");

    // No files should be left in the backup directory
    const files = fs.readdirSync(backupDir());
    expect(files.length).toBe(0);
  });
});
