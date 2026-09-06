import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const tmpDir = path.join(rootDir, ".tmp");

function checkDialectDrift(params: {
  dialect: "postgresql" | "sqlite";
  sourceDir: string;
  tempDir: string;
  env?: NodeJS.ProcessEnv;
}): { drifted: boolean; newFiles: string[] } {
  const { dialect, sourceDir, tempDir, env } = params;

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(tempDir), { recursive: true });
  fs.cpSync(sourceDir, tempDir, { recursive: true });

  const initialFiles = new Set(
    fs.readdirSync(tempDir).filter((f) => f.endsWith(".sql")),
  );

  const relativeOut = path.relative(rootDir, tempDir);

  try {
    execSync(
      `npx drizzle-kit generate --dialect=${dialect} --schema=./shared/schema.ts --out=./${relativeOut}`,
      {
        cwd: rootDir,
        env: {
          ...process.env,
          ...env,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (err: any) {
    console.error(`Failed to run drizzle-kit generate for ${dialect}:`, err.stderr?.toString() || err.message);
    throw err;
  }

  const currentFiles = fs
    .readdirSync(tempDir)
    .filter((f) => f.endsWith(".sql"));
  const newFiles = currentFiles.filter((f) => !initialFiles.has(f));

  return {
    drifted: newFiles.length > 0,
    newFiles,
  };
}

let hasDrift = false;
const tmpPg = path.join(tmpDir, "drift-pg");
const tmpSqlite = path.join(tmpDir, "drift-sqlite");

try {
  console.log("Checking PostgreSQL migration drift...");
  const pgResult = checkDialectDrift({
    dialect: "postgresql",
    sourceDir: path.join(rootDir, "migrations", "pg"),
    tempDir: tmpPg,
  });

  if (pgResult.drifted) {
    hasDrift = true;
    console.error(
      `\x1b[31m[DRIFT]\x1b[0m PostgreSQL schema drift detected! Generated migrations: ${pgResult.newFiles.join(", ")}`,
    );
    console.error("Run 'npm run db:generate' to generate the missing migration and commit it.");
  } else {
    console.log("✓ PostgreSQL migrations match shared/schema.ts");
  }

  console.log("Checking SQLite migration drift...");
  const sqliteResult = checkDialectDrift({
    dialect: "sqlite",
    sourceDir: path.join(rootDir, "migrations", "sqlite"),
    tempDir: tmpSqlite,
    env: { TS_NODE_PROJECT: "tsconfig.sqlite.json" },
  });

  if (sqliteResult.drifted) {
    hasDrift = true;
    console.error(
      `\x1b[31m[DRIFT]\x1b[0m SQLite schema drift detected! Generated migrations: ${sqliteResult.newFiles.join(", ")}`,
    );
    console.error(
      "Run 'npm run db:generate:sqlite' to generate the missing migration and commit it.",
    );
  } else {
    console.log("✓ SQLite migrations match shared/schema.ts");
  }
} finally {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (hasDrift) {
  console.error("\nMigration drift check failed. Checked-in migrations do not fully describe shared/schema.ts.");
  process.exit(1);
} else {
  console.log("\nMigration drift check passed: checked-in migrations fully describe shared/schema.ts for both dialects.");
}
