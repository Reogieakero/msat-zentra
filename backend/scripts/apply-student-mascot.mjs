// One-shot applier for prisma/migrations/20261016000000_student_mascot.
// Mirrors migration.sql statement-for-statement (idempotent: IF NOT EXISTS
// + WHERE mascot IS NULL), with progress logs. Safe to re-run.
import "dotenv/config";
import pg from "pg";

const CHARACTERS = [
  "afro", "astronaut", "bald", "ballerina", "bear", "beard", "builder",
  "bunny", "cap", "cat", "chef", "clockwork", "crt", "cube", "deer",
  "dino", "droid", "drone", "fox", "frog", "gearbot", "glasses", "grandpa",
  "granny", "hamster", "hedgehog", "hijabi", "kamran", "knight", "koala",
  "lantern", "mouse", "nurse", "otter", "owl", "panda", "penguin", "pirate",
  "postbot", "pug", "raccoon", "radio", "redpanda", "robot", "rocket",
  "scientist", "scout", "sheep", "sikh", "skater", "sloth", "tiger",
  "toaster", "tv", "wizard",
];
const charsLiteral = `ARRAY[${CHARACTERS.map((c) => `'${c}'`).join(",")}]`;

const BACKFILL = (table, idCol, nameExpr, join = "") => `
DO $$
DECLARE
  chars TEXT[] := ${charsLiteral};
  r RECORD;
  seed TEXT;
  h BIGINT;
  i INT;
BEGIN
  FOR r IN SELECT t."${idCol}" AS id, t."lrn" AS lrn, ${nameExpr} AS name
           FROM "${table}" t ${join} WHERE t."mascot" IS NULL
  LOOP
    seed := r.name || ':' || r.lrn;
    h := 0;
    FOR i IN 1..char_length(seed) LOOP
      h := (h * 31 + ascii(substring(seed FROM i FOR 1))) % 4294967296;
    END LOOP;
    UPDATE "${table}" SET "mascot" = chars[(h % 55) + 1] WHERE "${idCol}" = r.id;
  END LOOP;
END $$;`;

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

    log("step 1/5: ALTER StudentProfile ADD COLUMN mascot ...");
    await client.query(`ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "mascot" TEXT`);
    log("step 1/5 done");

    log("step 2/5: ALTER StudentRoster ADD COLUMN mascot ...");
    await client.query(`ALTER TABLE "StudentRoster" ADD COLUMN IF NOT EXISTS "mascot" TEXT`);
    log("step 2/5 done");

    const beforeP = await client.query(`SELECT COUNT(*)::int AS n FROM "StudentProfile" WHERE "mascot" IS NULL`);
    const beforeR = await client.query(`SELECT COUNT(*)::int AS n FROM "StudentRoster" WHERE "mascot" IS NULL`);
    log(`null mascots before backfill: profiles=${beforeP.rows[0].n} roster=${beforeR.rows[0].n}`);

    log("step 3/5: backfill StudentProfile ...");
    await client.query(BACKFILL("StudentProfile", "userId", `u."fullName"`, `JOIN "User" u ON u."id" = t."userId"`));
    log("step 3/5 done");

    log("step 4/5: backfill StudentRoster ...");
    await client.query(BACKFILL("StudentRoster", "id", `t."fullName"`));
    log("step 4/5 done");

    log("step 5/5: verify ...");
    const afterP = await client.query(`SELECT COUNT(*)::int AS n, COUNT(DISTINCT "mascot")::int AS d FROM "StudentProfile"`);
    const nullP = await client.query(`SELECT COUNT(*)::int AS n FROM "StudentProfile" WHERE "mascot" IS NULL`);
    const afterR = await client.query(`SELECT COUNT(*)::int AS n, COUNT(DISTINCT "mascot")::int AS d FROM "StudentRoster"`);
    const nullR = await client.query(`SELECT COUNT(*)::int AS n FROM "StudentRoster" WHERE "mascot" IS NULL`);
    log(`profiles: total=${afterP.rows[0].n} distinct_mascots=${afterP.rows[0].d} nulls=${nullP.rows[0].n}`);
    log(`roster: total=${afterR.rows[0].n} distinct_mascots=${afterR.rows[0].d} nulls=${nullR.rows[0].n}`);
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
