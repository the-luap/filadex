import { sql } from "drizzle-orm";
import { db } from "../server/db";

export async function columnExists(tableName: string, columnName: string) {
  const { rows } = await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1;
  `);

  return rows.length > 0;
}

export async function addColumnIfMissing(
  tableName: string,
  columnName: string,
  statement: ReturnType<typeof sql>,
) {
  if (await columnExists(tableName, columnName)) {
    console.log(`✓ ${tableName}.${columnName} already exists - skipping`);
    return;
  }

  await db.execute(statement);
}
