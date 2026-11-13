import "dotenv/config";
import jwt from "jsonwebtoken";
import { Client } from "pg";

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const g = await c.query(
  `select id, "fullName", role from "User" where role = 'guidance_counselor' and status = 'active' limit 3`,
);
console.table(g.rows);
const user = g.rows[0];
const token = jwt.sign(
  { sub: user.id, role: "guidance_counselor", gradeBand: null, type: "access" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "30m" },
);

const archived = await c.query(
  `select a."rosterId", a."studentId" from "AdviserArchivedStudent" a`,
);
const archivedRoster = new Set(archived.rows.map((r) => r.rosterId).filter(Boolean));
const archivedStudent = new Set(archived.rows.map((r) => r.studentId).filter(Boolean));
console.log("archived roster ids:", archivedRoster.size, "student ids:", archivedStudent.size);

const url = "http://localhost:4000/api/interventions?page=1&pageSize=16&level=All&outcome=all&sort=detected";
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
console.log("status:", res.status, "x-cache:", res.headers.get("x-cache"), "total:", body.total, "students:", body.students?.length);
const keys = (body.students ?? []).map((s: any) => s.studentKey);
const leakedRoster = keys.filter((k: string) => k.startsWith("roster:") && archivedRoster.has(k.slice(7)));
const leakedStudent = keys.filter((k: string) => archivedStudent.has(k));
console.log("archived learners in payload:", leakedRoster.length + leakedStudent.length, [...leakedRoster, ...leakedStudent].slice(0, 10));
console.log("summary:", JSON.stringify(body.summary));

const res2 = await fetch(url, {
  headers: { Authorization: `Bearer ${token}`, "x-zentra-fresh": "1" },
});
await res2.json();
console.log("second call x-cache:", res2.headers.get("x-cache"));
await c.end();
