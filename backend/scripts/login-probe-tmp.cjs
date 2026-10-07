require("dotenv/config");
const pg = require("pg");

const API = "http://localhost:4000";

async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role: "staff" }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function main() {
  for (const [who, email] of [
    ["principal", "principal@zentra.test"],
    ["master?", "teacher.noload@zentra.test"],
  ]) {
    const r = await login(email, "Zentra2025!");
    console.log(`${who}: status=${r.status} keys=${Object.keys(r.body).join(",")}`);
  }
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
