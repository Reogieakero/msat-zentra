require("dotenv/config");
const pg = require("pg");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

async function main() {
  await client.connect();
  const rls = await client.query(
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'Notification'"
  );
  console.log("RLS:", JSON.stringify(rls.rows));
  const pol = await client.query(
    "SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'Notification'"
  );
  console.log("POLICIES:", JSON.stringify(pol.rows, null, 1));
  const users = await client.query(
    `SELECT email, role, status FROM "User" WHERE email IN ('principal@zentra.test') OR "fullName" ILIKE '%master%' OR role = 'principal'`
  );
  console.log("ACCOUNTS:", JSON.stringify(users.rows));
  const masters = await client.query(
    `SELECT u.email FROM "User" u JOIN "StaffProfile" s ON s."userId" = u.id WHERE s."isMasterTeacher" = true`
  );
  console.log("MASTERS:", JSON.stringify(masters.rows));
  await client.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
