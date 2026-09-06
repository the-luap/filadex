import { afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Points BACKUP_DIR at a fresh temporary directory for every test in the calling
 * scope and removes it afterwards, restoring whatever BACKUP_DIR held before.
 * Returns an accessor, because the path only exists once beforeEach has run.
 */
export function useTempBackupDir(): () => string {
  let dir: string;
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.BACKUP_DIR;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "filadex-backup-test-"));
    process.env.BACKUP_DIR = dir;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BACKUP_DIR;
    } else {
      process.env.BACKUP_DIR = original;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  return () => dir;
}
