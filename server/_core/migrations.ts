/**
 * Idempotent runtime migrations.
 *
 * Reason: the production MySQL database has some columns that drifted from
 * the Drizzle schema. Most notably `moves.pickupDate` and `moves.deliveryDate`
 * were created as `DATE NULL` in production, while the schema defines them as
 * `TIMESTAMP NOT NULL`. The mismatch causes inserts of JS Date objects to
 * silently store NULL.
 *
 * Each function here is safe to run multiple times: it inspects the live
 * column definition first and only runs the ALTER if needed.
 */
import { getDb } from "../db";

type ColumnInfo = {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Key: string;
  Default: string | null;
  Extra: string;
};

async function getColumnInfo(table: string, column: string): Promise<ColumnInfo | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { sql } = await import("drizzle-orm");
    const result: any = await (db as any).execute(
      sql.raw(`SHOW COLUMNS FROM \`${table}\` WHERE Field = '${column}'`)
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : result;
    return Array.isArray(rows) && rows.length > 0 ? (rows[0] as ColumnInfo) : null;
  } catch (err) {
    console.error(`[migrations] Failed to inspect ${table}.${column}:`, err);
    return null;
  }
}

async function fixMovesDateColumns(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { sql } = await import("drizzle-orm");

  for (const col of ["pickupDate", "deliveryDate"] as const) {
    const info = await getColumnInfo("moves", col);
    if (!info) {
      console.log(`[migrations] moves.${col} not found, skipping`);
      continue;
    }

    const typeIsCorrect = info.Type.toLowerCase().startsWith("timestamp");
    const nullabilityIsCorrect = info.Null === "NO";

    if (typeIsCorrect && nullabilityIsCorrect) {
      console.log(`[migrations] moves.${col} OK (${info.Type}, Null=${info.Null})`);
      continue;
    }

    console.log(
      `[migrations] moves.${col} needs fix: was ${info.Type} Null=${info.Null}, fixing to TIMESTAMP NOT NULL`
    );

    try {
      await (db as any).execute(
        sql.raw(`UPDATE \`moves\` SET \`${col}\` = COALESCE(\`${col}\`, NOW()) WHERE \`${col}\` IS NULL`)
      );
      await (db as any).execute(
        sql.raw(`ALTER TABLE \`moves\` MODIFY COLUMN \`${col}\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`)
      );
      console.log(`[migrations] moves.${col} fixed successfully`);
    } catch (alterErr) {
      console.error(`[migrations] Failed to ALTER moves.${col}:`, alterErr);
    }
  }
}

/**
 * Run on server boot. Each migration is idempotent and logs its own status.
 * Failures are logged but do not crash the server – we'd rather start up
 * with a known-broken column than not start at all.
 */
async function fixMoveImagesColumns(): Promise<void> {
  console.log("[migrations] >>> running fixMoveImagesColumns");
  const db = await getDb();
  if (!db) {
    console.log("[migrations] >>> db not available, skipping moveImages migration");
    return;
  }

  const { sql } = await import("drizzle-orm");

  // Inspect existing columns once
  let existingCols: ColumnInfo[] = [];
  try {
    const result: any = await (db as any).execute(
      sql.raw(`SHOW COLUMNS FROM \`moveImages\``)
    );
    const rows = Array.isArray(result?.[0]) ? result[0] : result;
    existingCols = Array.isArray(rows) ? (rows as ColumnInfo[]) : [];
    console.log(
      `[migrations] moveImages has ${existingCols.length} columns: ${existingCols.map(c => c.Field).join(", ")}`
    );
  } catch (err) {
    console.error("[migrations] could not list moveImages columns:", err);
    return;
  }

  const colNames = new Set(existingCols.map(c => c.Field));

  // 1. Add `data` LONGBLOB column if missing.
  if (!colNames.has("data")) {
    try {
      await (db as any).execute(
        sql.raw(`ALTER TABLE \`moveImages\` ADD COLUMN \`data\` LONGBLOB NULL`)
      );
      console.log("[migrations] >>> moveImages.data column added");
    } catch (err) {
      console.error("[migrations] failed to add moveImages.data:", err);
    }
  } else {
    console.log("[migrations] moveImages.data already exists");
  }

  // 2. Add `mimeType` column if missing.
  if (!colNames.has("mimeType")) {
    try {
      await (db as any).execute(
        sql.raw(`ALTER TABLE \`moveImages\` ADD COLUMN \`mimeType\` VARCHAR(80) NOT NULL DEFAULT 'image/jpeg'`)
      );
      console.log("[migrations] >>> moveImages.mimeType column added");
    } catch (err) {
      console.error("[migrations] failed to add moveImages.mimeType:", err);
    }
  } else {
    console.log("[migrations] moveImages.mimeType already exists");
  }

  // 3. Make `imageUrl` nullable.
  const imageUrlCol = existingCols.find(c => c.Field === "imageUrl");
  if (imageUrlCol && imageUrlCol.Null === "NO" && imageUrlCol.Default === null) {
    try {
      await (db as any).execute(
        sql.raw(`ALTER TABLE \`moveImages\` MODIFY COLUMN \`imageUrl\` TEXT NULL`)
      );
      console.log("[migrations] >>> moveImages.imageUrl made nullable");
    } catch (err) {
      console.error("[migrations] failed to relax moveImages.imageUrl:", err);
    }
  } else {
    console.log(
      `[migrations] moveImages.imageUrl OK (Null=${imageUrlCol?.Null ?? "?"}, Default=${imageUrlCol?.Default ?? "null"})`
    );
  }

  // 4. Give `uploadedBy` a DEFAULT 0 so inserts that omit it don't crash.
  const uploadedByCol = existingCols.find(c => c.Field === "uploadedBy");
  if (uploadedByCol && uploadedByCol.Default === null) {
    try {
      await (db as any).execute(
        sql.raw(`ALTER TABLE \`moveImages\` MODIFY COLUMN \`uploadedBy\` INT NOT NULL DEFAULT 0`)
      );
      console.log("[migrations] >>> moveImages.uploadedBy DEFAULT 0 set");
    } catch (err) {
      console.error("[migrations] failed to set moveImages.uploadedBy default:", err);
    }
  } else {
    console.log(`[migrations] moveImages.uploadedBy already has default`);
  }
}

export async function runRuntimeMigrations(): Promise<void> {
  console.log("[migrations] starting runtime migrations");
  try {
    await fixMovesDateColumns();
  } catch (err) {
    console.error("[migrations] unexpected error in fixMovesDateColumns:", err);
  }
  try {
    await fixMoveImagesColumns();
  } catch (err) {
    console.error("[migrations] unexpected error in fixMoveImagesColumns:", err);
  }
  console.log("[migrations] done");
}
