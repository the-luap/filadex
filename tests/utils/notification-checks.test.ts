/**
 * Characterisation tests for server/utils/notification-checks.ts - the
 * low-stock and drying-reminder emails, run on a timer from server/index.ts.
 *
 * There is no HTTP boundary here, so the seam is the exported
 * runScheduledChecks() plus what it sends and what it records.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { runScheduledChecks } from "../../server/utils/notification-checks";
import { storage } from "../../server/storage";
import { db } from "../helpers/db";
import { filaments, materials, users } from "../../shared/schema";
import { mailbox, lastMailTo } from "../helpers/mailbox";

let aliceId: number;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

async function createUser(overrides: Record<string, unknown> = {}) {
  const user = await storage.createUser({
    username: `user-${Math.random().toString(36).slice(2, 8)}`,
    password: "hashed",
    email: `${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: "user",
    isAdmin: false,
    emailVerified: true,
    forceChangePassword: false,
  });
  if (Object.keys(overrides).length > 0) {
    await db.update(users).set(overrides).where(eq(users.id, user.id));
  }
  return (await storage.getUser(user.id))!;
}

async function giveSpool(userId: number, overrides: Record<string, unknown> = {}) {
  return storage.createFilament({
    userId,
    name: "Spool",
    material: "PLA",
    colorName: "Black",
    totalWeight: "1000",
    remainingPercentage: "80",
    ...overrides,
  } as never);
}

beforeEach(async () => {
  aliceId = (await createUser()).id;
});

describe("low-stock notifications", () => {
  it("emails the owner about spools at or below their threshold", async () => {
    const user = await storage.getUser(aliceId);
    await giveSpool(aliceId, { name: "Nearly empty", remainingPercentage: "5" });
    await giveSpool(aliceId, { name: "Exactly at threshold", remainingPercentage: "15" });
    await giveSpool(aliceId, { name: "Plenty left", remainingPercentage: "90" });

    await runScheduledChecks();

    const mail = lastMailTo(user!.email!);
    expect(mail).toBeDefined();
    expect(mail!.html).toContain("Nearly empty");
    expect(mail!.html).toContain("Exactly at threshold");
    expect(mail!.html).not.toContain("Plenty left");
  });

  it("sends one email per user, not one per spool", async () => {
    await giveSpool(aliceId, { name: "One", remainingPercentage: "1" });
    await giveSpool(aliceId, { name: "Two", remainingPercentage: "2" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(1);
  });

  it("honours a threshold the user chose", async () => {
    await db.update(users).set({ lowStockThresholdPercent: 50 }).where(eq(users.id, aliceId));
    await giveSpool(aliceId, { name: "Half full", remainingPercentage: "40" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(1);
  });

  it("does not send the same reminder twice", async () => {
    await giveSpool(aliceId, { name: "Nearly empty", remainingPercentage: "5" });

    await runScheduledChecks();
    mailbox.length = 0;
    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("starts reminding again once the spool is marked as not yet notified", async () => {
    const spool = await giveSpool(aliceId, { name: "Nearly empty", remainingPercentage: "5" });
    await runScheduledChecks();
    mailbox.length = 0;

    await db.update(filaments).set({ lowStockNotifiedAt: null }).where(eq(filaments.id, spool.id));
    await runScheduledChecks();

    expect(mailbox).toHaveLength(1);
  });

  it("stays quiet for a user who switched low-stock emails off", async () => {
    await db.update(users).set({ notifyLowStock: false }).where(eq(users.id, aliceId));
    await giveSpool(aliceId, { remainingPercentage: "1" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });
});

describe("drying reminders", () => {
  beforeEach(async () => {
    await storage.createMaterial({ name: "PLA", isHygroscopic: true });
  });

  it("reminds about a hygroscopic spool that has not been dried recently", async () => {
    await giveSpool(aliceId, { name: "Thirsty", lastDryingDate: daysAgo(40) });

    await runScheduledChecks();

    const mail = mailbox.at(-1);
    expect(mail?.html).toContain("Thirsty");
  });

  it("falls back to the purchase date when the spool was never dried", async () => {
    await giveSpool(aliceId, { name: "Never dried", purchaseDate: daysAgo(60) });

    await runScheduledChecks();

    expect(mailbox.at(-1)?.html).toContain("Never dried");
  });

  it("prefers the drying date over the purchase date", async () => {
    await giveSpool(aliceId, { name: "Dried yesterday", purchaseDate: daysAgo(300), lastDryingDate: daysAgo(1) });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("says nothing about a spool with neither date", async () => {
    await giveSpool(aliceId, { name: "No dates" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("says nothing about a material that does not absorb moisture", async () => {
    await storage.createMaterial({ name: "PETG", isHygroscopic: false });
    await giveSpool(aliceId, { name: "Dry material", material: "PETG", lastDryingDate: daysAgo(400) });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  // The hygroscopic list is matched against the filament's free-text material,
  // so the comparison has to ignore case for a spool entered as "pla" to count
  // as the catalog's "PLA".
  it("recognises a material whose case differs from the catalog", async () => {
    await giveSpool(aliceId, { name: "Lowercase pla", material: "pla", lastDryingDate: daysAgo(400) });

    await runScheduledChecks();

    expect(mailbox.at(-1)?.html).toContain("Lowercase pla");
  });

  it("still ignores a material that is not in the hygroscopic list at all", async () => {
    await giveSpool(aliceId, { name: "Not hygroscopic", material: "abs", lastDryingDate: daysAgo(400) });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("honours the interval the user chose", async () => {
    await db.update(users).set({ dryingReminderDays: 7 }).where(eq(users.id, aliceId));
    await giveSpool(aliceId, { name: "Ten days", lastDryingDate: daysAgo(10) });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(1);
  });

  it("waits a day before reminding about the same spool again", async () => {
    await giveSpool(aliceId, { name: "Thirsty", lastDryingDate: daysAgo(40) });

    await runScheduledChecks();
    mailbox.length = 0;
    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("reminds again once a day has passed", async () => {
    const spool = await giveSpool(aliceId, { name: "Thirsty", lastDryingDate: daysAgo(40) });
    await runScheduledChecks();
    mailbox.length = 0;

    await db.update(filaments)
      .set({ dryingReminderNotifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(filaments.id, spool.id));
    await runScheduledChecks();

    expect(mailbox).toHaveLength(1);
  });

  it("stays quiet for a user who switched drying reminders off", async () => {
    await db.update(users).set({ notifyDryingReminder: false }).where(eq(users.id, aliceId));
    await giveSpool(aliceId, { lastDryingDate: daysAgo(400) });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });
});

describe("who gets checked at all", () => {
  it("skips a user who has not verified their email", async () => {
    const unverified = await createUser({ emailVerified: false });
    await giveSpool(unverified.id, { remainingPercentage: "1" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("skips a user with no email address", async () => {
    const noEmail = await createUser({ email: null });
    await giveSpool(noEmail.id, { remainingPercentage: "1" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("skips a user who switched both kinds of email off", async () => {
    await db.update(users)
      .set({ notifyLowStock: false, notifyDryingReminder: false })
      .where(eq(users.id, aliceId));
    await giveSpool(aliceId, { remainingPercentage: "1" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });

  it("never tells one user about another user's spools", async () => {
    const bob = await createUser();
    await giveSpool(aliceId, { name: "Alice's spool", remainingPercentage: "1" });
    await giveSpool(bob.id, { name: "Bob's spool", remainingPercentage: "1" });

    await runScheduledChecks();

    const toAlice = lastMailTo((await storage.getUser(aliceId))!.email!);
    expect(toAlice!.html).toContain("Alice's spool");
    expect(toAlice!.html).not.toContain("Bob's spool");
  });

  it("sends nothing when there is nothing to report", async () => {
    await giveSpool(aliceId, { remainingPercentage: "95" });

    await runScheduledChecks();

    expect(mailbox).toHaveLength(0);
  });
});

describe("per-user hygroscopy", () => {
  // With Personal Catalogs, the hygroscopic-name lookup is per user: one user
  // marking a private material hygroscopic must not start flagging every user's
  // Spools. See docs/adr/0003-per-user-material-catalog.md.
  it("reminds only the user whose Personal Catalog marks the material hygroscopic", async () => {
    const alice = await storage.getUser(aliceId);
    const bob = await createUser();

    // Both declare "Damp" - auto-registered into each Personal Catalog, dry.
    await giveSpool(aliceId, { name: "Alice Damp", material: "Damp", lastDryingDate: daysAgo(400) });
    await giveSpool(bob.id, { name: "Bob Damp", material: "Damp", lastDryingDate: daysAgo(400) });

    // Only Alice's copy is hygroscopic.
    await db.update(materials).set({ isHygroscopic: true })
      .where(and(eq(materials.userId, aliceId), eq(materials.name, "Damp")));

    await runScheduledChecks();

    expect(lastMailTo(alice!.email!)?.html).toContain("Alice Damp");
    expect(lastMailTo(bob.email!)).toBeUndefined();
    expect(mailbox.some((m) => m.html.includes("Bob Damp"))).toBe(false);
  });

  // A Personal Catalog row and a Global one can hold the same name: the two
  // partial unique indexes are disjoint by design. `resolveMaterial` is
  // personal-wins, so the hygroscopy lookup has to be too - otherwise the user
  // unchecks "hygroscopic" on their own row and the reminders keep coming with
  // nothing in the UI explaining why.
  it("lets the user's own row override a Global Catalog row of the same name", async () => {
    // Alice declares PLA-CF; auto-registration gives her a blank personal row.
    await giveSpool(aliceId, { name: "Alice CF", material: "PLA-CF", lastDryingDate: daysAgo(400) });
    // An admin later approves her Catalog Request, which creates it globally.
    await storage.createMaterial({ name: "PLA-CF", density: "1.24", isHygroscopic: true });

    await runScheduledChecks();

    expect(mailbox.some((m) => m.html.includes("Alice CF"))).toBe(false);
  });

  it("still reminds when the user's own row is the hygroscopic one", async () => {
    const alice = await storage.getUser(aliceId);

    await giveSpool(aliceId, { name: "Alice CF", material: "PLA-CF", lastDryingDate: daysAgo(400) });
    await storage.createMaterial({ name: "PLA-CF", isHygroscopic: false });
    await db.update(materials).set({ isHygroscopic: true })
      .where(and(eq(materials.userId, aliceId), eq(materials.name, "PLA-CF")));

    await runScheduledChecks();

    expect(lastMailTo(alice!.email!)?.html).toContain("Alice CF");
  });
});
