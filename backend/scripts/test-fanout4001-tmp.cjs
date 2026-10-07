require("dotenv/config");
const pg = require("pg");

const API = "http://localhost:4001";
const TERM_ID = "aa953be3-e35e-4b5e-af07-9bf09df3f3e9"; // Term 1

async function login(email) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Zentra2025!", role: "staff" }),
  });
  const body = await r.json();
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return body.accessToken;
}

async function main() {
  const masterToken = await login("teacher.noload@zentra.test");
  const pgc = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await pgc.connect();

  // G7-B still has DRAFT rows (G7-A was submitted in the earlier test).
  const sec = await pgc.query(
    `SELECT s.id, s.name, COUNT(e.id) AS drafts FROM "Section" s
     JOIN "SectionTimetableEntry" e ON e."sectionId" = s.id AND e."termId" = $1 AND e.status = 'DRAFT'
     WHERE s.name = 'G7-B' GROUP BY s.id, s.name`,
    [TERM_ID]
  );
  if (sec.rows.length === 0) throw new Error("G7-B has no drafts");
  const sectionId = sec.rows[0].id;
  console.log("SECTION:", sec.rows[0].name, `drafts=${sec.rows[0].drafts}`);

  const principal = await pgc.query(`SELECT id FROM "User" WHERE email = 'principal@zentra.test'`);
  const principalId = principal.rows[0].id;

  const sub = await fetch(`${API}/api/teacher/schedule/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
      "x-term-id": TERM_ID,
    },
    body: JSON.stringify({ sectionId }),
  });
  console.log("SUBMIT:", sub.status, JSON.stringify(await sub.json().catch(() => ({}))));

  const note = await pgc.query(
    `SELECT id, type, message FROM "Notification" WHERE "userId" = $1 AND type = 'schedule_submitted' ORDER BY "createdAt" DESC LIMIT 1`,
    [principalId]
  );
  console.log("NOTIF_ROW:", JSON.stringify(note.rows[0] ?? null));

  const fs = require("fs");
  fs.writeFileSync(
    "scripts/test-state-tmp.json",
    JSON.stringify({ sectionId, termId: TERM_ID, notifId: note.rows[0]?.id ?? null, principalId })
  );
  await pgc.end();
}

main().catch((e) => { console.error("ERR:", e.message, e.stack?.split("\n")[1] ?? ""); process.exit(1); });
