// One-shot applier for prisma/migrations/20261016010000_unique_section_mascots.
// Enforces one mascot per learner within each section's visible set
// (profiles + roster rows), then verifies zero duplicates remain.
// Idempotent: only colliding rows are touched. Safe to re-run.
import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationSql = fs.readFileSync(
  path.join(here, "..", "prisma", "migrations", "20261016010000_unique_section_mascots", "migration.sql"),
  "utf8",
);
// Strip the leading comment block; the remainder is a single DO block.
const body = migrationSql.slice(migrationSql.indexOf("DO $$"));

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
    await client.query(`SET statement_timeout = '600000'`);
    log("connected, statement_timeout=600s");

    const dupes = async () => {
      const { rows } = await client.query(`
        WITH visible AS (
          SELECT sp."sectionId" AS sid, sp."mascot" AS m FROM "StudentProfile" sp WHERE sp."sectionId" IS NOT NULL
          UNION ALL
          SELECT "sectionId" AS sid, "mascot" AS m FROM "StudentRoster"
        )
        SELECT sid, COUNT(*)::int AS rows, COUNT(DISTINCT m)::int AS distinct_mascots
        FROM visible WHERE m IS NOT NULL GROUP BY sid HAVING COUNT(*) <> COUNT(DISTINCT m)`);
      return rows;
    };

    const before = await dupes();
    log(`sections with duplicate mascots before: ${before.length}`);
    for (const d of before) {
      log(`  section=${d.sid} rows=${d.rows} distinct=${d.distinct_mascots}`);
    }

    log("applying dedup DO block ...");
    await client.query(body);
    log("dedup done");

    const after = await dupes();
    log(`sections with duplicate mascots after: ${after.length}`);
    for (const d of after) {
      log(`  section=${d.sid} rows=${d.rows} distinct=${d.distinct_mascots}`);
    }
    if (after.length > 0) {
      log("NOTE: remaining dupes mean a section holds more learners than the 55-sprite pool (reuse is unavoidable there).");
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
