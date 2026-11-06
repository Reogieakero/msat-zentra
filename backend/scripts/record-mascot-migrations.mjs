// Records idempotently-applied mascot migrations in _prisma_migrations so
// `migrate deploy` / `migrate status` treat them as applied. Uses the same
// SHA-256-of-migration.sql checksum Prisma stores for resolve --applied.
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = [
  "20261016000000_student_mascot",
  "20261016010000_unique_section_mascots",
];

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function stripSslMode(url) {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return url;
  const parts = url.slice(qIdx + 1).split("&").filter((p) => p && !p.startsWith("sslmode="));
  return parts.length ? `${url.slice(0, qIdx)}?${parts.join("&")}` : url.slice(0, qIdx);
}

const pool = new pg.Pool({
  connectionString: stripSslMode(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30_000,
});

try {
  const client = await pool.connect();
  try {
    for (const name of MIGRATIONS) {
      const sql = fs.readFileSync(
        path.join(here, "..", "prisma", "migrations", name, "migration.sql"),
        "utf8",
      );
      const checksum = crypto.createHash("sha256").update(sql, "utf8").digest("hex");
      const existing = await client.query(
        `SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" = $1`,
        [name],
      );
      if (existing.rowCount > 0) {
        log(`${name}: already recorded, skipping`);
        continue;
      }
      await client.query(
        `INSERT INTO "_prisma_migrations"
           ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES (gen_random_uuid()::text, $1, NOW(), $2, '', NULL, NOW(), 1)`,
        [checksum, name],
      );
      log(`${name}: recorded as applied (checksum ${checksum.slice(0, 12)}…)`);
    }
    const rows = await client.query(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" LIKE '20261016%' ORDER BY "migration_name"`,
    );
    log(`mascot migrations in history: ${rows.rows.map((r) => r.migration_name).join(", ")}`);
    log("ALL DONE");
  } finally {
    client.release();
  }
} catch (err) {
  log(`FAILED: ${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
