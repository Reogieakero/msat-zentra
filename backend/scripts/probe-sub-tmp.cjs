require("dotenv/config");

const API = "http://localhost:4000";

async function login(email) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Zentra2025!", role: "staff" }),
  });
  const body = await r.json();
  if (r.status !== 200) throw new Error(`login failed: ${r.status}`);
  return body.accessToken;
}

async function main() {
  const principalToken = await login("principal@zentra.test");
  const r = await fetch(`${API}/api/academics/schedule/submissions`, {
    headers: { Authorization: `Bearer ${principalToken}` },
  });
  const body = await r.json().catch(() => ({}));
  console.log("SUBMISSIONS:", r.status);
  if (r.status === 200) {
    for (const s of body.sections || []) {
      console.log(` - ${s.name}: ${s.timetableEntries.length} submitted slots`);
    }
  } else {
    console.log(JSON.stringify(body).slice(0, 200));
  }
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
