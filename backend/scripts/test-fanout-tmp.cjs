require("dotenv/config");
const pg = require("pg");

const API = "http://localhost:4000";
const TERM_ID = "aa953be3-e35e-4b5e-af07-9bf09df3f3e9"; // Term 1
const results = {};

async function login(email) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Zentra2025!", role: "staff" }),
  });
  const body = await r.json();
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

async function main() {
  // 0. Freshness probe: newer route must exist on the running server.
  const masterToken = await login("teacher.noload@zentra.test");
  const probe = await fetch(`${API}/api/teacher/schedule/subjects`, {
    headers: { Authorization: `Bearer ${masterToken}`, "x-term-id": TERM_ID },
  });
  const probeBody = await probe.json().catch(() => ({}));
  results.fresh_server =
    probe.status === 200 && Array.isArray(probeBody.subjects) && "category" in (probeBody.subjects[0] || {});
  console.log("FRESH_SERVER:", results.fresh_server, `status=${probe.status}`);
  if (!results.fresh_server) {
    console.log("STALE_SERVER_ABORT");
    return;
  }

  // 1. Pick a G7 section with DRAFT entries in T1.
  const pgc = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await pgc.connect();
  const sec = await pgc.query(
    `SELECT s.id, s.name, COUNT(e.id) AS drafts FROM "Section" s
     JOIN "SectionTimetableEntry" e ON e."sectionId" = s.id AND e."termId" = $1 AND e.status = 'DRAFT'
     WHERE s."gradeLevel" = 'G7' GROUP BY s.id, s.name ORDER BY s.name LIMIT 1`,
    [TERM_ID]
  );
  if (sec.rows.length === 0) throw new Error("no draft section found");
  const sectionId = sec.rows[0].id;
  console.log("SECTION:", sec.rows[0].name, `drafts=${sec.rows[0].drafts}`);

  const principal = await pgc.query(`SELECT id FROM "User" WHERE email = 'principal@zentra.test'`);
  const principalId = principal.rows[0].id;
  const beforeNotes = await pgc.query(
    `SELECT COUNT(*) AS c FROM "Notification" WHERE "userId" = $1 AND type = 'schedule_submitted'`,
    [principalId]
  );
  console.log("PRINCIPAL_NOTES_BEFORE:", beforeNotes.rows[0].c);

  // 2. Master submits that section.
  const sub = await fetch(`${API}/api/teacher/schedule/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
      "x-term-id": TERM_ID,
    },
    body: JSON.stringify({ sectionId }),
  });
  const subBody = await sub.json().catch(() => ({}));
  console.log("SUBMIT:", sub.status, JSON.stringify(subBody));
  results.submit_ok = sub.status === 200 && subBody.submitted > 0;

  // 3. DB: entries flipped + notification row exists.
  const flipped = await pgc.query(
    `SELECT status, COUNT(*) AS c FROM "SectionTimetableEntry" WHERE "sectionId" = $1 AND "termId" = $2 GROUP BY status`,
    [sectionId, TERM_ID]
  );
  console.log("ENTRY_STATUS:", JSON.stringify(flipped.rows));
  const note = await pgc.query(
    `SELECT id, type, message, "isRead" FROM "Notification" WHERE "userId" = $1 AND type = 'schedule_submitted' ORDER BY "createdAt" DESC LIMIT 1`,
    [principalId]
  );
  console.log("NOTIF_ROW:", JSON.stringify(note.rows[0] ?? null));
  results.db_row = note.rows.length === 1 && note.rows[0].message.includes(sec.rows[0].name);
  results.notif_id = note.rows[0]?.id;

  // 4. Principal reads inbox via API.
  const principalToken = await login("principal@zentra.test");
  const inbox = await fetch(`${API}/api/notifications/`, {
    headers: { Authorization: `Bearer ${principalToken}` },
  });
  const inboxBody = await inbox.json().catch(() => []);
  const found = Array.isArray(inboxBody) && inboxBody.some((n) => n.id === results.notif_id);
  console.log("INBOX_API:", inbox.status, `found=${found}`);
  results.inbox_api = inbox.status === 200 && found;

  // stash for cleanup + socket test
  const fs = require("fs");
  fs.writeFileSync(
    "scripts/test-state-tmp.json",
    JSON.stringify({ sectionId, termId: TERM_ID, notifId: results.notif_id, principalId })
  );
  console.log("RESULTS:", JSON.stringify({ ...results, notif_id: undefined }));
  await pgc.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
