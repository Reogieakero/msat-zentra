require("dotenv/config");
const pg = require("pg");

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  console.log("connected");
  const r = await client.query("SELECT $1::text AS v", ["hello"]);
  console.log("param query ok:", JSON.stringify(r.rows));
  await client.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
