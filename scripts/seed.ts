/**
 * Seeds the database with starter options or demo fixture data.
 *
 *   npx tsx scripts/seed.ts --starter   # fills dropdown lists on fresh install (safe against live DB)
 *   npx tsx scripts/seed.ts --demo      # fills every table with fixture data (refuses if users exist)
 *
 * See docs/adr/0004.
 */
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, closeDb } from "@db";
import {
  users,
  foldUsername,
  filamentTypes,
  filaments,
  manufacturers,
  materials,
  colors,
  diameters,
  storageLocations,
  userSharing,
  emailSettings,
  catalogRequests,
  filamentUsageLog,
  customFieldDefinitions,
  communityFilamentCache,
  apiTokens,
} from "@shared/schema";

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const dateDaysAgo = (days: number) => daysAgo(days).toISOString().slice(0, 10);

async function seedStarter(): Promise<void> {
  const [existing] = await db.select({ count: sql<number>`count(*)` }).from(manufacturers);
  if (Number(existing.count) > 0) {
    console.log("Data already exists in the database, skipping starter initialization.");
    return;
  }

  console.log("Adding starter selection options (manufacturers, materials, colors, etc.)...");
  await db.transaction(async (tx) => {
    await tx.insert(manufacturers).values([
      { name: "Bambu Lab", sortOrder: 1 },
      { name: "Prusament", sortOrder: 2 },
      { name: "Filamentworld", sortOrder: 3 },
      { name: "Ninjatek", sortOrder: 4 },
    ]).onConflictDoNothing();

    await tx.insert(materials).values([
      { name: "PLA", sortOrder: 1, density: "1.24", isHygroscopic: false },
      { name: "PETG", sortOrder: 2, density: "1.27", isHygroscopic: true },
      { name: "ABS", sortOrder: 3, density: "1.04", isHygroscopic: true },
      { name: "TPU", sortOrder: 4, density: "1.21", isHygroscopic: true },
    ]).onConflictDoNothing();

    await tx.insert(diameters).values([
      { value: "1.75" },
    ]).onConflictDoNothing();

    await tx.insert(colors).values([
      { name: "Black (Bambu Lab)", code: "#000000" },
      { name: "White (Bambu Lab)", code: "#FFFFFF" },
      // Carried over from the seed docker-entrypoint.sh ran before this script
      // existed, so a fresh install still starts with the Bambu Lab codes.
      { name: "Dark Gray (Bambu Lab)", code: "#545454" },
      { name: "Red (Bambu Lab)", code: "#C12E1F" },
      { name: "Blue (Bambu Lab)", code: "#0A2989" },
      { name: "Transparent", code: "#FFFFFF" },
      { name: "Red", code: "#F44336" },
      { name: "Gray", code: "#9E9E9E" },
    ]).onConflictDoNothing();

    await tx.insert(storageLocations).values([
      { name: "Dry box A", sortOrder: 1 },
      { name: "Shelf", sortOrder: 2 },
    ]).onConflictDoNothing();
  });

  console.log("Basic starter selection options inserted.");
}

/**
 * The four sample spools init-data.ts created under INIT_SAMPLE_DATA, kept on
 * the same flag.
 *
 * They need an owner, and the only account a fresh install has is the default
 * admin the application creates at startup - so on the very first Docker start,
 * where the entrypoint seeds before the application runs, there is nobody to own
 * them and this is a no-op.
 *
 * The entrypoint re-runs the seeder on *every* start, though, so by the second
 * one the admin exists. An empty `filaments` table cannot tell "fresh install"
 * apart from "install whose owner has not added a spool yet", which is how these
 * fixtures would otherwise appear in a real inventory after a reboot. The admin
 * having logged in at least once is the signal that the install belongs to
 * somebody: past that point these spools are never inserted again, whatever the
 * flag says and however empty the table gets.
 */
async function seedSampleSpools(): Promise<void> {
  if (process.env.INIT_SAMPLE_DATA !== "true") return;

  const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!admin) {
    console.log("Sample spools need an account to own them; the application creates the default admin next.");
    return;
  }

  if (admin.lastLogin) {
    console.log("The admin account is already in use, skipping sample spools.");
    return;
  }

  const [existing] = await db.select({ count: sql<number>`count(*)` }).from(filaments);
  if (Number(existing.count) > 0) {
    console.log("Spools already exist, skipping sample spools.");
    return;
  }

  await db.transaction(async (tx) => {
    const types = await tx.insert(filamentTypes).values([
      { userId: admin.id, manufacturer: "Bambu Lab", material: "PLA", colorName: "Black", colorCode: "#000000", diameter: "1.75", printTemp: "200-220" },
      { userId: admin.id, manufacturer: "Prusament", material: "PETG", colorName: "Transparent", colorCode: "#FFFFFF", diameter: "1.75", printTemp: "230-250" },
      { userId: admin.id, manufacturer: "Filamentworld", material: "ABS", colorName: "Red", colorCode: "#F44336", diameter: "1.75", printTemp: "240-260" },
      { userId: admin.id, manufacturer: "Ninjatek", material: "TPU", colorName: "Gray", colorCode: "#9E9E9E", diameter: "1.75", printTemp: "210-230" },
    ]).returning();

    await tx.insert(filaments).values([
      { userId: admin.id, filamentTypeId: types[0].id, name: "PLA Black Bambu Lab", totalWeight: "1000", remainingPercentage: "65" },
      { userId: admin.id, filamentTypeId: types[1].id, name: "PETG Transparent", totalWeight: "1000", remainingPercentage: "15" },
      { userId: admin.id, filamentTypeId: types[2].id, name: "ABS Red", totalWeight: "1000", remainingPercentage: "0" },
      { userId: admin.id, filamentTypeId: types[3].id, name: "TPU Flexible Gray", totalWeight: "500", remainingPercentage: "75" },
    ]);
  });

  console.log("Sample spools inserted: 4.");
}

async function seedDemo(): Promise<void> {
  const [existing] = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(existing.count) > 0) {
    console.error("Refusing to seed: the users table already has rows.");
    process.exit(1);
  }

  const password = await bcrypt.hash("demo-password", 10);

  // One transaction, so a failure leaves nothing half-seeded.
  await db.transaction(async (tx) => {
    const seedUsers = [
      {
        username: "admin", password, role: "admin", isAdmin: true,
        emailVerified: true, forceChangePassword: false, lastLogin: daysAgo(1),
      },
      {
        username: "alice", email: "alice@example.com", password, role: "user", isAdmin: false,
        emailVerified: true, forceChangePassword: false, language: "en", currency: "EUR",
        temperatureUnit: "C", lastLogin: daysAgo(2), lowStockThresholdPercent: 20,
        themeVariant: "tint", themePrimary: "#00AAFF", themeAppearance: "light", themeRadius: "1.25",
      },
      {
        username: "bob", email: "bob@example.com", password, role: "user", isAdmin: false,
        emailVerified: true, forceChangePassword: true, language: "de", currency: "PLN",
        temperatureUnit: "F", notifyLowStock: false, dryingReminderDays: 14,
      },
      {
        username: "carol", email: "carol@example.com", password, role: "user", isAdmin: false,
        emailVerified: false, forceChangePassword: false,
        emailVerificationToken: "seed-verification-token", emailVerificationExpires: daysAgo(-1),
      },
    ];

    // Derived here rather than written out, for the reason storage.ts derives it:
    // a row whose folded form disagrees with its username answers to the wrong
    // name, and a fixture is no more exempt from that than an account is.
    const inserted = await tx.insert(users).values(
      seedUsers.map((user) => ({ ...user, usernameFolded: foldUsername(user.username) })),
    ).returning();

    // Looked up by name rather than destructured positionally: a multi-row
    // .returning() is not promised to come back in the order it was written,
    // and a fixture that silently gave alice's spools to bob would still seed
    // without error.
    const byName = new Map(inserted.map((user) => [user.username, user]));
    const seeded = (username: string) => {
      const user = byName.get(username);
      if (!user) throw new Error(`Seed user ${username} was not inserted.`);
      return user;
    };
    const admin = seeded("admin");
    const alice = seeded("alice");
    const bob = seeded("bob");
    const unverified = seeded("carol");

    await tx.insert(manufacturers).values([
      { name: "Bambu Lab", sortOrder: 1 },
      { name: "Prusament", sortOrder: 2 },
      { name: "Overture", sortOrder: 3 },
    ]);

    const catalogMaterials = await tx.insert(materials).values([
      { name: "PLA", sortOrder: 1, density: "1.24", isHygroscopic: false },
      { name: "PETG", sortOrder: 2, density: "1.27", isHygroscopic: true },
      { name: "ABS", sortOrder: 3, density: "1.04", isHygroscopic: true },
      { name: "TPU", sortOrder: 4, density: "1.21", isHygroscopic: true },
    ]).returning();
    const petg = catalogMaterials.find((m) => m.name === "PETG")!;

    await tx.insert(colors).values([
      { name: "Black", code: "#000000" },
      { name: "Jade White", code: "#FFFFFF" },
      { name: "Orange", code: "#EA580C" },
    ]);
    await tx.insert(diameters).values([{ value: "1.75" }, { value: "2.85" }]);
    await tx.insert(storageLocations).values([
      { name: "Dry box A", sortOrder: 1 },
      { name: "Shelf", sortOrder: 2 },
    ]);

    // Spool instances, via their product identity - the same split storage.ts uses.
    const types = await tx.insert(filamentTypes).values([
      { userId: alice.id, manufacturer: "Bambu Lab", material: "PLA", colorName: "Jade White", colorCode: "#FFFFFF", diameter: "1.75", printTemp: "220" },
      { userId: alice.id, manufacturer: "Prusament", material: "PETG", colorName: "Orange", colorCode: "#EA580C", diameter: "1.75", printTemp: "240" },
      { userId: bob.id, manufacturer: "Overture", material: "ABS", colorName: "Black", colorCode: "#000000", diameter: "2.85", printTemp: "250" },
    ]).returning();

    const spools = await tx.insert(filaments).values([
      {
        userId: alice.id, filamentTypeId: types[0].id, name: "Jade White #1",
        totalWeight: "1000", remainingPercentage: "82.5", purchaseDate: dateDaysAgo(120),
        purchasePrice: "24.99", status: "opened", spoolType: "spooled", dryerCount: 2,
        lastDryingDate: dateDaysAgo(40), storageLocation: "Dry box A",
        customFieldValues: { "1": "printed a benchy" },
      },
      {
        // Below Alice's 20% threshold, and already notified - so a scheduled
        // check must leave it alone.
        userId: alice.id, filamentTypeId: types[1].id, name: "Orange PETG (low)",
        totalWeight: "1000", remainingPercentage: "8", purchaseDate: dateDaysAgo(300),
        purchasePrice: "29.99", status: "opened", spoolType: "spooled", dryerCount: 0,
        storageLocation: "Shelf", lowStockNotifiedAt: daysAgo(3),
        dryingReminderNotifiedAt: daysAgo(1),
      },
      {
        userId: bob.id, filamentTypeId: types[2].id, name: "Black ABS sealed",
        totalWeight: "1000", remainingPercentage: "100", purchaseDate: dateDaysAgo(10),
        purchasePrice: "19.50", status: "sealed", spoolType: "spoolless", dryerCount: 0,
      },
    ]).returning();

    await tx.insert(filamentUsageLog).values([
      { filamentId: spools[0].id, userId: alice.id, deltaWeight: "-120", remainingPercentageAfter: "88", note: "benchy", source: "manual" },
      { filamentId: spools[0].id, userId: alice.id, deltaWeight: "-55", remainingPercentageAfter: "82.5", source: "printer" },
      { filamentId: spools[1].id, userId: alice.id, deltaWeight: "-900", remainingPercentageAfter: "8", source: "manual" },
    ]);

    await tx.insert(customFieldDefinitions).values([
      { userId: alice.id, name: "Notes", entityType: "filament", fieldType: "text" },
      { userId: bob.id, name: "Batch", entityType: "filament", fieldType: "text" },
    ]);

    // Alice shares PETG only; Bob shares everything.
    await tx.insert(userSharing).values([
      { userId: alice.id, materialId: petg.id, isPublic: true },
      { userId: bob.id, materialId: null, isPublic: true },
      { userId: unverified.id, materialId: null, isPublic: false },
    ]);

    await tx.insert(catalogRequests).values([
      { userId: alice.id, entityType: "material", payload: { name: "PCTG" }, status: "pending" },
      { userId: bob.id, entityType: "manufacturer", payload: { name: "Polymaker" }, status: "approved", reviewedBy: admin.id, reviewedAt: daysAgo(5) },
      { userId: bob.id, entityType: "color", payload: { name: "Puce", code: "#CC8899" }, status: "rejected", reviewNote: "too niche", reviewedBy: admin.id, reviewedAt: daysAgo(4) },
    ]);

    await tx.insert(apiTokens).values([
      { userId: alice.id, tokenHash: "seed-token-hash-alice", label: "Print server", lastUsedAt: daysAgo(1) },
      { userId: bob.id, tokenHash: "seed-token-hash-bob", label: null },
    ]);

    await tx.insert(communityFilamentCache).values([
      { manufacturer: "Bambu Lab", material: "PLA", name: "Basic PLA Jade White", colorName: "Jade White", colorCode: "#FFFFFF", density: "1.24", diameter: "1.75", extruderTemp: 220, bedTemp: 60 },
      { manufacturer: "Prusament", material: "PETG", name: "Prusament PETG Orange", colorName: "Orange", colorCode: "#EA580C", density: "1.27", diameter: "1.75", extruderTemp: 240, bedTemp: 85 },
    ]);

    // The email settings row is seeded by a migration, so this updates rather
    // than inserts - there is exactly one, with a fixed id.
    const settings = {
      enabled: false, smtpHost: "smtp.example.com", smtpPort: 587,
      smtpUser: "postmaster", smtpPassword: "not-a-real-password", smtpSecure: true,
      fromEmail: "filadex@example.com", fromName: "Filadex",
    };
    await tx.insert(emailSettings).values({ id: 1, ...settings })
      .onConflictDoUpdate({ target: emailSettings.id, set: settings });
  });

  console.log("Seeded: 4 users, 3 filament types, 3 spools, 3 usage log entries,");
  console.log("        4 materials, 3 manufacturers, 3 colors, 2 diameters, 2 locations,");
  console.log("        3 sharing settings, 3 catalog requests, 2 API tokens,");
  console.log("        2 custom fields, 2 cached community filaments, 1 email settings row.");
}

async function main() {
  const isDemo = process.argv.includes("--demo");
  if (isDemo) {
    await seedDemo();
  } else {
    await seedStarter();
    // Outside seedStarter, which returns early once the catalog is populated.
    // The spools need an admin the application has not created yet on a first
    // run, so the run that seeds them is a later one, against a catalog that
    // already exists.
    await seedSampleSpools();
  }
}

main()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
