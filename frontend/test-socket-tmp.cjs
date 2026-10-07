require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: "C:/Users/jalan/OneDrive/Desktop/New folder/E-zentra/backend/.env" });
const { createClient } = require("@supabase/supabase-js");
const pg = require("C:/Users/jalan/OneDrive/Desktop/New folder/E-zentra/backend/node_modules/pg");
const fs = require("fs");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  const state = JSON.parse(
    fs.readFileSync(
      "C:/Users/jalan/OneDrive/Desktop/New folder/E-zentra/backend/scripts/test-state-tmp.json",
      "utf-8"
    )
  );
  const principalId = state.principalId;
  const marker = `RT-TEST-${Date.now()}`;

  const supabase = createClient(URL, ANON);
  let resolvePayload;
  const gotPayload = new Promise((resolve, reject) => {
    resolvePayload = resolve;
    setTimeout(() => reject(new Error("TIMEOUT waiting for realtime payload")), 15000);
  });

  const channel = supabase
    .channel(`test-principal-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "Notification", filter: `userId=eq.${principalId}` },
      (payload) => resolvePayload(payload.new)
    );

  const subStatus = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(status);
    });
    setTimeout(() => resolve("SUBSCRIBE_TIMEOUT"), 10000);
  });
  console.log("SUBSCRIBE:", subStatus);
  if (subStatus !== "SUBSCRIBED") throw new Error(`subscribe failed: ${subStatus}`);

  // Insert exactly like the backend fanout does (service-level SQL).
  const pgc = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgc.connect();
  await pgc.query(
    `INSERT INTO "Notification" (id, "userId", type, "sourceTable", message, channel)
     VALUES (gen_random_uuid(), $1, 'schedule_submitted', 'section_timetable_entries', $2, '{web}')`,
    [principalId, marker]
  );
  console.log("INSERTED marker row (backend-style)");

  const row = await gotPayload;
  console.log("PAYLOAD_RECEIVED:", row.message === marker ? "MATCH" : "MISMATCH");

  await pgc.query('DELETE FROM "Notification" WHERE message = $1', [marker]);
  console.log("TEST_ROW_DELETED");
  await pgc.end();
  await supabase.removeChannel(channel);
  console.log("SOCKET_TEST: PASS");
}

main().catch((e) => { console.error("SOCKET_TEST: FAIL -", e.message); process.exit(1); });
