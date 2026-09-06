import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { isBackupDue, runScheduledBackupCheck } from "../server/backup-scheduler";
import { storage } from "../server/storage";
import { logger } from "../server/utils/logger";
import type { BackupSettings } from "@shared/schema";
import { useTempBackupDir } from "./helpers/backup-dir";

describe("isBackupDue", () => {
  it("returns false if settings is null or undefined or disabled or off", () => {
    expect(isBackupDue(null)).toBe(false);
    expect(isBackupDue(undefined)).toBe(false);
    expect(isBackupDue({ id: 1, enabled: false, schedule: "daily", time: "02:00", dayOfWeek: 1, retentionCount: 7, lastBackupAt: null })).toBe(false);
    expect(isBackupDue({ id: 1, enabled: true, schedule: "off", time: "02:00", dayOfWeek: 1, retentionCount: 7, lastBackupAt: null })).toBe(false);
  });

  it("returns false if time format is invalid", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "invalid",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: null,
    };
    expect(isBackupDue(settings, new Date(2026, 8, 5, 2, 0, 0))).toBe(false);
  });

  it("returns true when current time is exactly at scheduled daily target", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 4, 2, 0, 0), // yesterday
    };
    const now = new Date(2026, 8, 5, 2, 0, 0);
    expect(isBackupDue(settings, now)).toBe(true);
  });

  it("returns true when a tick is delayed or missed (current minute > target minute)", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 4, 2, 0, 0), // yesterday
    };
    // 3 minutes late due to system delay
    const now = new Date(2026, 8, 5, 2, 3, 0);
    expect(isBackupDue(settings, now)).toBe(true);
  });

  it("returns true when server restarts past the target hour (restarted at 03:30)", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 4, 2, 0, 0), // yesterday
    };
    const now = new Date(2026, 8, 5, 3, 30, 0);
    expect(isBackupDue(settings, now)).toBe(true);
  });

  it("returns false if time has not arrived yet today", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 4, 2, 0, 0),
    };
    const now = new Date(2026, 8, 5, 1, 59, 0);
    expect(isBackupDue(settings, now)).toBe(false);
  });

  it("returns false if already backed up today after scheduled target time", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 5, 2, 1, 0), // backed up today at 02:01
    };
    // Checking at 04:00 today
    const now = new Date(2026, 8, 5, 4, 0, 0);
    expect(isBackupDue(settings, now)).toBe(false);
  });

  it("respects the 1-hour dedupe guard", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 5, 1, 45, 0), // 15 mins ago
    };
    const now = new Date(2026, 8, 5, 2, 0, 0);
    expect(isBackupDue(settings, now)).toBe(false);
  });

  it("handles weekly schedule correctly on correct day and wrong day", () => {
    // 2026-09-07 is a Monday (dayOfWeek = 1)
    // 2026-09-08 is a Tuesday (dayOfWeek = 2)
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "weekly",
      time: "03:00",
      dayOfWeek: 1, // Monday
      retentionCount: 7,
      lastBackupAt: new Date(2026, 7, 31, 3, 0, 0), // Last Monday
    };

    // Tuesday at 03:00 -> true (missed Monday backup is due)
    expect(isBackupDue(settings, new Date(2026, 8, 8, 3, 0, 0))).toBe(true);

    // After running on Tuesday at 03:05, Wednesday at 03:00 should not be due
    const completedSettings: Partial<BackupSettings> = {
      ...settings,
      lastBackupAt: new Date(2026, 8, 8, 3, 5, 0),
    };
    expect(isBackupDue(completedSettings, new Date(2026, 8, 9, 3, 0, 0))).toBe(false);

    // Next Monday at 03:00 (2026-09-14) should be due again
    expect(isBackupDue(completedSettings, new Date(2026, 8, 14, 3, 0, 0))).toBe(true);

    // Monday before target -> false
    expect(isBackupDue(settings, new Date(2026, 8, 7, 2, 59, 0))).toBe(false);

    // Monday exactly at target -> true
    expect(isBackupDue(settings, new Date(2026, 8, 7, 3, 0, 0))).toBe(true);

    // Monday 30 minutes late -> true
    expect(isBackupDue(settings, new Date(2026, 8, 7, 3, 30, 0))).toBe(true);
  });

  it("is due on the target weekday before the target time when the previous week was missed", () => {
    // 2026-08-31 and 2026-09-07 are Mondays. The Aug 31 run never happened.
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "weekly",
      time: "03:00",
      dayOfWeek: 1, // Monday
      retentionCount: 7,
      lastBackupAt: new Date(2026, 7, 24, 3, 0, 0), // two Mondays ago
    };

    // Monday 01:00: today's 03:00 has not arrived, but Aug 31 03:00 is missed and overdue.
    expect(isBackupDue(settings, new Date(2026, 8, 7, 1, 0, 0))).toBe(true);

    // Having run on Aug 31 as scheduled, Monday 01:00 is not due again before 03:00.
    const ranOnTime: Partial<BackupSettings> = { ...settings, lastBackupAt: new Date(2026, 7, 31, 3, 0, 0) };
    expect(isBackupDue(ranOnTime, new Date(2026, 8, 7, 1, 0, 0))).toBe(false);
  });

  it("is due before the target time when a daily run was missed", () => {
    const settings: Partial<BackupSettings> = {
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "03:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: new Date(2026, 8, 3, 3, 0, 0), // two days ago
    };

    // 01:00: today's 03:00 has not arrived, but yesterday's is missed and overdue.
    expect(isBackupDue(settings, new Date(2026, 8, 5, 1, 0, 0))).toBe(true);

    // Having run yesterday as scheduled, 01:00 is not due again before 03:00.
    const ranOnTime: Partial<BackupSettings> = { ...settings, lastBackupAt: new Date(2026, 8, 4, 3, 0, 0) };
    expect(isBackupDue(ranOnTime, new Date(2026, 8, 5, 1, 0, 0))).toBe(false);
  });
});

describe("runScheduledBackupCheck", () => {
  // Spies must be dropped even when an assertion throws, or they leak into siblings.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing if dialect is not sqlite", async () => {
    vi.spyOn(storage, "getDialect").mockReturnValue("postgres");
    const getSettingsSpy = vi.spyOn(storage, "getBackupSettings");
    await runScheduledBackupCheck();
    expect(getSettingsSpy).not.toHaveBeenCalled();
  });

  it("does not create backup when backup is not due", async () => {
    vi.spyOn(storage, "getDialect").mockReturnValue("sqlite");
    vi.spyOn(storage, "getBackupSettings").mockResolvedValue({
      id: 1,
      enabled: false,
      schedule: "off",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: null,
      updatedAt: new Date(),
    });
    const backupsModule = await import("../server/routes/backups");
    const createBackupSpy = vi.spyOn(backupsModule, "createBackupFile");
    await runScheduledBackupCheck();
    expect(createBackupSpy).not.toHaveBeenCalled();
  });

  it("catches and logs error if createBackupFile fails", async () => {
    vi.spyOn(storage, "getDialect").mockReturnValue("sqlite");
    vi.spyOn(storage, "getBackupSettings").mockResolvedValue({
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      lastBackupAt: null,
      updatedAt: new Date(),
    });
    const backupsModule = await import("../server/routes/backups");
    vi.spyOn(backupsModule, "createBackupFile").mockRejectedValue(new Error("disk full"));
    const loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await expect(runScheduledBackupCheck()).resolves.toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalledWith("Scheduled backup failed:", expect.any(Error));
  });

  it("does not start a second backup while one is still running", async () => {
    vi.spyOn(storage, "getDialect").mockReturnValue("sqlite");
    vi.spyOn(storage, "getBackupSettings").mockResolvedValue({
      id: 1,
      enabled: true,
      schedule: "daily",
      time: "02:00",
      dayOfWeek: 1,
      retentionCount: 7,
      // Never backed up, so every tick sees a due backup: lastBackupAt is only
      // written once the run finishes, which is exactly the window that lets a
      // long VACUUM INTO be joined by the next interval tick.
      lastBackupAt: null,
      updatedAt: new Date(),
    });

    const backupsModule = await import("../server/routes/backups");
    let release: () => void = () => {};
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    const createBackupSpy = vi
      .spyOn(backupsModule, "createBackupFile")
      .mockImplementation(async () => {
        await inFlight;
        return { filename: "filadex-backup-test.db", size: 1, createdAt: new Date().toISOString() };
      });

    const first = runScheduledBackupCheck();
    // A second tick arriving while the first backup is still open.
    await runScheduledBackupCheck();
    expect(createBackupSpy).toHaveBeenCalledTimes(1);

    release();
    await first;

    // Once the first run has finished the guard is clear again.
    await runScheduledBackupCheck();
    expect(createBackupSpy).toHaveBeenCalledTimes(2);
  });
});

describe.skipIf(storage.getDialect() !== "sqlite")("runScheduledBackupCheck SQLite end-to-end", () => {
  const backupDir = useTempBackupDir();

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls createBackupFile and records lastBackupAt when backup is due", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 3, 0, 0));

    await storage.updateBackupSettings({
      enabled: true,
      schedule: "daily",
      time: "02:00",
      lastBackupAt: null,
    });

    await runScheduledBackupCheck();

    const settingsAfter = await storage.getBackupSettings();
    expect(settingsAfter?.lastBackupAt).not.toBeNull();

    const files = fs.readdirSync(backupDir()).filter((f) => f.startsWith("filadex-backup-"));
    expect(files.length).toBe(1);

    // Running again immediately should be a no-op due to dedupe/target check
    await runScheduledBackupCheck();
    const filesAfter = fs.readdirSync(backupDir()).filter((f) => f.startsWith("filadex-backup-"));
    expect(filesAfter.length).toBe(1);
  });
});

