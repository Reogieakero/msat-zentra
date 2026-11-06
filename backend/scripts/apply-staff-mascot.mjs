// One-shot applier for prisma/migrations/20261017010000_staff_mascot.
// `prisma migrate deploy` hangs through the Supabase pooler (pgbouncer
// transaction mode), so this applies the idempotent DDL directly and
// records it in _prisma_migrations with the same SHA-256 checksum Prisma
// stores — mirroring scripts/record-mascot-migrations.mjs. Safe to re-run.
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const NAME = "20261017010000_staff_mascot";

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
  const sql = fs.readFileSync(
    path.join(here, "..", "prisma", "migrations", NAME, "migration.sql"),
    "utf8",
  );
  const client = await pool.connect();
  try {
    await client.query(sql);
    log("DDL applied (ADD COLUMN IF NOT EXISTS mascot)");

    const col = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'StaffProfile' AND column_name = 'mascot'`,
    );
    log(`mascot column present: ${col.rowCount === 1}`);

    const checksum = crypto.createHash("sha256").update(sql, "utf8").digest("hex");
    const existing = await client.query(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" = $1`,
      [NAME],
    );
    if (existing.rowCount > 0) {
      log(`${NAME}: already recorded, skipping`);
    } else {
      await client.query(
        `INSERT INTO "_prisma_migrations"
           ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES (gen_random_uuid()::text, $1, NOW(), $2, '', NULL, NOW(), 1)`,
        [checksum, NAME],
      );
      log(`${NAME}: recorded as applied (checksum ${checksum.slice(0, 12)}…)`);
    }
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
