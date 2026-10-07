require("dotenv/config");
const pg = require("pg");
const TERM_ID = "aa953be3-e35e-4b5e-af07-9bf09df3f3e9";

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    query_timeout: 30000,
    statement_timeout: 30000,
  });
  await client.connect();
  console.log("connected");
  const sec = await client.query(
    `SELECT s.id, s.name, COUNT(e.id) AS drafts FROM "Section" s
     JOIN "SectionTimetableEntry" e ON e."sectionId" = s.id AND e."termId" = $1 AND e.status = 'DRAFT'
     WHERE s.name = 'G7-B' GROUP BY s.id, s.name`,
    [TERM_ID]
  );
  console.log("rows:", JSON.stringify(sec.rows));
  await client.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
