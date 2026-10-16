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
const pick = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length];
};

const pool = new pg.Pool({
  connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30000,
});
const client = await pool.connect();
try {
  const p = await client.query(
    `SELECT u."fullName" AS name, sp.lrn, sp.mascot FROM "StudentProfile" sp JOIN "User" u ON u."id" = sp."userId" LIMIT 6`,
  );
  const r = await client.query(
    `SELECT "fullName" AS name, lrn, mascot FROM "StudentRoster" LIMIT 6`,
  );
  let mismatches = 0;
  for (const row of [...p.rows, ...r.rows]) {
    const expected = pick(`${row.name}:${row.lrn}`);
    const mark = expected === row.mascot ? "OK  " : "DIFF";
    if (expected !== row.mascot) mismatches += 1;
    console.log(`${mark} stored=${row.mascot} derived=${expected} :: ${row.name} : ${row.lrn}`);
  }
  console.log(mismatches === 0 ? "ALL MATCH" : `${mismatches} MISMATCHES`);
  if (mismatches > 0) process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
