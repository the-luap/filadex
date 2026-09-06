import { afterAll, beforeAll, beforeEach, vi } from "vitest";

// The application builds its database connection at import time from DATABASE_URL
// (server/db.ts or server/db.sqlite.ts via @db). Point it at the test database
// instead - reached through the dialect's driver, owned by the test suite.
vi.mock("@db", async () => {
  const { db, dialect, vacuumBackup } = await import("./helpers/db");
  return {
    db,
    dialect,
    vacuumBackup,
    pool: undefined,
    client: undefined,
  };
});
vi.mock("../server/db.ts", async () => {
  const { db, dialect, vacuumBackup } = await import("./helpers/db");
  return { db, dialect, vacuumBackup, pool: undefined };
});

// SMTP is an external boundary: collect what would have been sent.
vi.mock("../server/utils/mailer.ts", async () => {
  const { mailbox } = await import("./helpers/mailbox");
  return {
    sendMail: async (mail: { to: string; subject: string; html: string }) => {
      mailbox.push(mail);
      return true;
    },
    getEmailSettings: async () => undefined,
  };
});

// The auth routes install per-IP rate limiters at module scope. Every request
// from supertest comes from the same address, so the limiters would trip part
// way through the suite and make results depend on test order. Rate limiting is
// not DB-backed and is not what these tests characterise, so it is disabled.
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

beforeAll(async () => {
  const { createSchema } = await import("./helpers/db");
  await createSchema();
});

beforeEach(async () => {
  const [{ resetDb }, { clearMailbox }] = await Promise.all([
    import("./helpers/db"),
    import("./helpers/mailbox"),
  ]);
  await resetDb();
  clearMailbox();
});

afterAll(async () => {
  const { closeDb } = await import("./helpers/db");
  await closeDb();
});
