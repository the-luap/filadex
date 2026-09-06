import type { Express, Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { authenticate, isAdmin } from "../auth";
import { storage } from "../storage";
import { updateBackupSettingsSchema } from "@shared/schema";
import { logger } from "../utils/logger";

/**
 * The prefix createBackupFile gives every snapshot it writes.
 *
 * listBackupFiles is what pruneBackups deletes from, so it must enumerate only
 * files this application created. BACKUP_DIR can be pointed anywhere - at
 * /data, for instance, where the live database sits - and without this an
 * operator's own files are counted towards retention and eventually unlinked.
 */
const BACKUP_FILENAME_PREFIX = "filadex-backup-";

/** True for the snapshots createBackupFile writes, and nothing else. */
function isBackupFilename(filename: string): boolean {
  return (
    filename.startsWith(BACKUP_FILENAME_PREFIX) &&
    (filename.endsWith(".db") || filename.endsWith(".sqlite"))
  );
}

export function getBackupDir(): string {
  if (process.env.BACKUP_DIR) {
    return path.resolve(process.env.BACKUP_DIR);
  }
  if (process.env.NODE_ENV === "production") {
    return "/data/backups";
  }
  return path.resolve(process.cwd(), "data", "backups");
}

export interface BackupFileInfo {
  filename: string;
  fullPath: string;
  size: number;
  createdAt: string;
  mtime: number;
}

export function listBackupFiles(backupDir: string): BackupFileInfo[] {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs
    .readdirSync(backupDir)
    .filter(isBackupFilename);
  const backups = files
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      try {
        const stat = fs.statSync(fullPath);
        return {
          filename: file,
          fullPath,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          mtime: stat.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is BackupFileInfo => item !== null);

  backups.sort((a, b) => b.mtime - a.mtime); // newest first
  return backups;
}

export function pruneBackups(backupDir: string, retentionCount: number): void {
  // updateBackupSettingsSchema now rejects anything below 1, but a row written
  // by an earlier build can still hold 0 or a negative number, and either one
  // is destructive here: slice(0) deletes every backup, and slice(-n) deletes
  // the n oldest on every single run. Keep at least one snapshot regardless.
  const keep = Math.max(1, Math.floor(retentionCount));
  const backups = listBackupFiles(backupDir);
  if (backups.length > keep) {
    const toDelete = backups.slice(keep);
    for (const item of toDelete) {
      try {
        fs.unlinkSync(item.fullPath);
      } catch (err) {
        logger.error(`Failed to prune backup ${item.fullPath}:`, err);
      }
    }
  }
}

export async function createBackupFile(): Promise<{ filename: string; size: number; createdAt: string }> {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${BACKUP_FILENAME_PREFIX}${timestamp}.db`;
  const fullPath = path.join(backupDir, filename);

  await storage.createBackup(fullPath);

  const stat = fs.statSync(fullPath);
  await storage.updateBackupSettings({ lastBackupAt: new Date() });

  const settings = await storage.getBackupSettings();
  const retentionCount = settings?.retentionCount ?? 7;
  pruneBackups(backupDir, retentionCount);

  return {
    filename,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

function resolveBackupPath(filename: string): string | null {
  const base = path.basename(filename);
  if (base !== filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  // The same predicate listBackupFiles enumerates by, for the same reason: with
  // BACKUP_DIR pointed at /data, an unprefixed *.db match resolves the live
  // database, and the download route would serve it although it is never listed.
  if (!isBackupFilename(filename)) {
    return null;
  }
  const backupDir = getBackupDir();
  const fullPath = path.resolve(backupDir, filename);
  const resolvedDir = path.resolve(backupDir);
  if (!fullPath.startsWith(resolvedDir + path.sep)) {
    return null;
  }
  return fullPath;
}

function requireSqliteDialect(_req: Request, res: Response, next: NextFunction) {
  if (storage.getDialect() !== "sqlite") {
    return res.status(400).json({ message: "Backups are only supported on SQLite installations" });
  }
  next();
}

export function registerBackupRoutes(app: Express): void {
  // System database dialect information (open to any authenticated or client query)
  app.get("/api/system/database", authenticate, (_req: Request, res: Response) => {
    res.json({ dialect: storage.getDialect() });
  });

  // Get backup settings (admin only, SQLite only)
  app.get("/api/admin/backups/settings", authenticate, isAdmin, requireSqliteDialect, async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getBackupSettings();
      if (!settings) {
        return res.json({
          id: 1,
          enabled: false,
          schedule: "off",
          time: "02:00",
          dayOfWeek: 1,
          retentionCount: 7,
          lastBackupAt: null,
        });
      }
      res.json(settings);
    } catch (error) {
      logger.error("Error fetching backup settings:", error);
      res.status(500).json({ message: "Failed to fetch backup settings" });
    }
  });

  // Update backup settings (admin only, SQLite only)
  app.put("/api/admin/backups/settings", authenticate, isAdmin, requireSqliteDialect, async (req: Request, res: Response) => {
    try {
      const validated = updateBackupSettingsSchema.partial().parse(req.body);
      const updated = await storage.updateBackupSettings(validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      logger.error("Error updating backup settings:", error);
      res.status(500).json({ message: "Failed to update backup settings" });
    }
  });

  // List existing backups on disk (admin only, SQLite only)
  app.get("/api/admin/backups", authenticate, isAdmin, requireSqliteDialect, async (_req: Request, res: Response) => {
    try {
      const backupDir = getBackupDir();
      const backups = listBackupFiles(backupDir).map(({ filename, size, createdAt }) => ({
        filename,
        size,
        createdAt,
      }));
      res.json(backups);
    } catch (error) {
      logger.error("Error listing backups:", error);
      res.status(500).json({ message: "Failed to list backups" });
    }
  });

  // Trigger immediate backup snapshot to disk (admin only, SQLite only)
  app.post("/api/admin/backups", authenticate, isAdmin, requireSqliteDialect, async (_req: Request, res: Response) => {
    try {
      const result = await createBackupFile();
      res.status(201).json(result);
    } catch (error) {
      logger.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create database backup" });
    }
  });

  // Stream a fresh snapshot directly without leaving a persistent file behind (admin only, SQLite only)
  app.post("/api/admin/backups/stream", authenticate, isAdmin, requireSqliteDialect, async (_req: Request, res: Response) => {
    const tempFile = path.join(os.tmpdir(), `filadex-snapshot-${nanoid()}.db`);
    const cleanup = () => {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {
        // Best effort: the file is in the OS temp directory anyway.
      }
    };

    try {
      await storage.createBackup(tempFile);
      const stat = fs.statSync(tempFile);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      res.setHeader("Content-Type", "application/x-sqlite3");
      res.setHeader("Content-Disposition", `attachment; filename="${BACKUP_FILENAME_PREFIX}${timestamp}.db"`);
      res.setHeader("Content-Length", stat.size);

      // pipeline rather than stream.pipe: it destroys the read stream when the
      // client aborts, instead of leaving the descriptor open until GC, and it
      // routes a read error into this catch. A bare pipe leaves the read stream
      // without an 'error' listener, and an unhandled 'error' event terminates
      // the process.
      await pipeline(fs.createReadStream(tempFile), res);
    } catch (error) {
      if (res.headersSent) {
        // The body was already going out, so this is the client hanging up
        // mid-download rather than a server fault, and there is no status left
        // to send.
        logger.debug("Backup snapshot download did not complete:", error);
        res.destroy();
      } else {
        logger.error("Error streaming backup snapshot:", error);
        res.status(500).json({ message: "Failed to stream backup snapshot" });
      }
    } finally {
      cleanup();
    }
  });

  // Download an existing backup file (admin only, SQLite only, strict path containment)
  app.get("/api/admin/backups/:filename", authenticate, isAdmin, requireSqliteDialect, async (req: Request, res: Response) => {
    const filePath = resolveBackupPath(req.params.filename);
    if (!filePath) {
      return res.status(400).json({ message: "Invalid backup filename" });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    res.download(filePath, path.basename(filePath));
  });
}
