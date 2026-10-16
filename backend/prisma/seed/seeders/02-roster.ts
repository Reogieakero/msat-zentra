import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import argon2 from "argon2";
import { SECTION_PLAN, STUDENT_PASSWORD, PARENT_PASSWORD, DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { Rng } from "../utils/rng.js";
import { makeLrn, registerLrn, resetLrnRegistry } from "../utils/rng.js";
import { MALE_FIRST, FEMALE_FIRST, LAST, MI, buildNamesForGenders } from "../../../prisma/data/filipino-names.js";
import { bulkCreate } from "../utils/chunk.js";

export interface RosterCtx {
  rosterAll: { id: string; lrn: string; fullName: string; sectionId: string; gradeLevel: string }[];
  rosterById: Map<string, { id: string; lrn: string; fullName: string; sectionId: string; gradeLevel: string }>;
  profiles: { userId: string; lrn: string; sectionId: string; gradeLevel: string; ability: number; attendRate: number }[];
  profileByUser: Map<string, { userId: string; lrn: string; sectionId: string; gradeLevel: string; ability: number; attendRate: number }>;
  rosterAbility: Map<string, { ability: number; attendRate: number }>; // rosterId -> archetype
  parentByStudent: Map<string, string>; // studentUserId -> parentUserId
}

const BARANGAYS = ["Commonwealth", "Payatas", "Tatalon", "Kamuning", "Sacred Heart", "Pinyahan", "Central", "Malaya", "Sta. Lucia", "San Roque"];
const STREETS = ["Mabini", "Bonifacio", "Rizal", "Del Pilar", "Luna", "Jacinto", "Kalayaan", "Malaya", "Sampaguita", "Ilang-Ilang"];

function abilityFor(rng: Rng): number {
  const r = rng.next();
  if (r < 0.1) return rng.float(0.85, 0.98); // excellent
  if (r < 0.7) return rng.float(0.6, 0.85); // average
  if (r < 0.9) return rng.float(0.4, 0.6); // low
  if (r < 0.97) return rng.float(0.25, 0.4); // struggling
  return rng.float(0.1, 0.25); // chronic
}

function attendRateFor(rng: Rng, ability: number): number {
  const r = rng.next();
  let base: number;
  if (r < 0.7) base = 0.95;
  else if (r < 0.85) base = 0.88;
  else if (r < 0.95) base = 0.75;
  else base = 0.6;
  // Correlate: low ability drags attendance slightly.
  if (ability < 0.4) base -= 0.06;
  return Math.min(0.99, Math.max(0.5, base + rng.float(-0.02, 0.02)));
}

export async function seedRoster(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  rng: Rng,
): Promise<RosterCtx> {
  resetLrnRegistry();
  // Register existing LRNs to avoid collisions (fresh wipe => mostly empty).
  const existing = await prisma.studentRoster.findMany({ select: { lrn: true } });
  for (const e of existing) registerLrn(e.lrn);
  const existingP = await prisma.studentProfile.findMany({ select: { lrn: true } });
  for (const e of existingP) registerLrn(e.lrn);

  // ---- Build roster plan (uneven sizes) ----
  const plan: { sectionId: string; gradeLevel: string; size: number }[] = [];
  for (const sec of acad.sections) {
    const cfg = SECTION_PLAN[sec.gradeLevel] ?? { min: 35, max: 40 };
    plan.push({ sectionId: sec.id, gradeLevel: sec.gradeLevel, size: rng.int(cfg.min, cfg.max) });
  }
  const totalPlanned = plan.reduce((a, p) => a + p.size, 0);

  // Genders + names deterministic.
  const genders: ("Male" | "Female")[] = [];
  for (let i = 0; i < totalPlanned; i++) genders.push(rng.next() < 0.5 ? "Female" : "Male");
  const names = buildNamesForGenders(genders);

  if (!DRY) {
    const rows: any[] = [];
    let ni = 0;
    for (const p of plan) {
      const gradeNum = p.gradeLevel.replace("G", "");
      for (let k = 0; k < p.size; k++) {
        const lrn = makeLrn(rng, gradeNum, String(k % 10));
        rows.push({
          lrn,
          fullName: names[ni],
          gradeLevel: p.gradeLevel as any,
          sectionId: p.sectionId,
          schoolYearId: core.syId,
        });
        ni++;
      }
    }
    await bulkCreate("Roster", rows.length, (ch) => prisma.studentRoster.createMany({ data: ch, skipDuplicates: true }) as any, rows, 2000);
  }

  const rosterAll = await prisma.studentRoster.findMany({
    where: { schoolYearId: core.syId },
    select: { id: true, lrn: true, fullName: true, sectionId: true, gradeLevel: true },
  });
  const rosterById = new Map(rosterAll.map((r) => [r.id, r]));

  // Archetypes for every roster (used for grades/attendance correlation).
  const rosterAbility = new Map<string, { ability: number; attendRate: number }>();
  // Deterministic per-roster via hash of id + global seed (stable across runs).
  for (const r of rosterAll) {
    let h = 2166136261;
    const key = r.id;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const f = ((h >>> 0) % 10000) / 10000;
    const ability = f < 0.1 ? 0.85 + (f * 10 * 0.13) : f < 0.7 ? 0.6 + ((f - 0.1) / 0.6) * 0.25 : f < 0.9 ? 0.4 + ((f - 0.7) / 0.2) * 0.2 : f < 0.97 ? 0.25 + ((f - 0.9) / 0.07) * 0.15 : 0.1 + ((f - 0.97) / 0.03) * 0.15;
    const attendRate = f < 0.7 ? 0.95 : f < 0.85 ? 0.88 : f < 0.95 ? 0.75 : 0.6;
    rosterAbility.set(r.id, { ability, attendRate });
  }

  // ---- Profiles: 90% of roster get accounts (every 10th stays roster-only) ----
  const withAccount = rosterAll.filter((_, i) => i % 10 !== 9);
  const profiles: RosterCtx["profiles"] = [];
  const parentByStudent = new Map<string, string>();

  if (!DRY && withAccount.length) {
    const studentHash = await argon2.hash(STUDENT_PASSWORD);
    const parentHash = await argon2.hash(PARENT_PASSWORD);
    // Users first (bulk).
    const userRows = withAccount.map((r) => ({
      email: `student.${r.lrn}@zentra.test`,
      fullName: r.fullName,
      role: "student" as const,
      passwordHash: studentHash,
      status: "active" as const,
      lrn: r.lrn,
    }));
    await bulkCreate("StudentUsers", userRows.length, (ch) => prisma.user.createMany({ data: ch, skipDuplicates: true }) as any, userRows, 1000);

    const createdUsers = await prisma.user.findMany({ where: { email: { startsWith: "student." } }, select: { id: true, email: true, fullName: true } });
    const userByLrn = new Map<string, string>();
    for (const u of createdUsers) {
      const m = u.email.match(/student\.(\d+)@/);
      if (m) userByLrn.set(m[1], u.id);
    }

    const profRows: any[] = [];
    const parentUserRows: any[] = [];
    for (const r of withAccount) {
      const uid = userByLrn.get(r.lrn);
      if (!uid) continue;
      const idx = rosterAll.indexOf(r);
      const gender = genders[idx] ?? "Female";
      const birthYear = 2026 - (12 + Number(r.gradeLevel.replace("G", "")) - 7) - (rng.next() < 0.5 ? 0 : 1);
      profRows.push({
        userId: uid,
        lrn: r.lrn,
        gradeLevel: r.gradeLevel as any,
        sectionId: r.sectionId,
        birthdate: new Date(Date.UTC(birthYear, rng.int(0, 11), rng.int(1, 28))),
        gender,
        address: `${rng.int(1, 999)} ${rng.pick(STREETS)} St., Brgy. ${rng.pick(BARANGAYS)}, Quezon City`,
      });
      parentUserRows.push({
        email: `parent.${r.lrn}@zentra.test`,
        fullName: `Parent of ${r.fullName}`,
        role: "parent" as const,
        passwordHash: parentHash,
        status: "active" as const,
      });
    }
    await bulkCreate("StudentProfiles", profRows.length, (ch) => prisma.studentProfile.createMany({ data: ch, skipDuplicates: true }) as any, profRows, 1000);
    await bulkCreate("ParentUsers", parentUserRows.length, (ch) => prisma.user.createMany({ data: ch, skipDuplicates: true }) as any, parentUserRows, 1000);

    const parentUsers = await prisma.user.findMany({ where: { email: { startsWith: "parent." } }, select: { id: true, email: true } });
    const pUserByLrn = new Map<string, string>();
    for (const u of parentUsers) {
      const m = u.email.match(/parent\.(\d+)@/);
      if (m) pUserByLrn.set(m[1], u.id);
    }
    const pProfRows: any[] = [];
    const linkRows: any[] = [];
    const secAdv = new Map(acad.sections.map((s) => [s.id, s.adviserId]));
    for (const r of withAccount) {
      const puid = pUserByLrn.get(r.lrn);
      const suid = userByLrn.get(r.lrn);
      if (!puid || !suid) continue;
      pProfRows.push({ userId: puid, address: `${rng.int(1, 999)} ${rng.pick(STREETS)} St., Quezon City`, occupation: rng.pick(["Vendor", "Driver", "Teacher", "Nurse", "Engineer", "Accountant", "OFW", "Seller"] as const) });
      linkRows.push({ parentId: puid, studentId: suid, relationship: rng.pick(["Mother", "Father", "Guardian"] as const), approvedBy: secAdv.get(r.sectionId) ?? core.principalId });
      parentByStudent.set(suid, puid);
    }
    await bulkCreate("ParentProfiles", pProfRows.length, (ch) => prisma.parentProfile.createMany({ data: ch, skipDuplicates: true }) as any, pProfRows, 1000);
    await bulkCreate("ParentLinks", linkRows.length, (ch) => prisma.parentStudentLink.createMany({ data: ch, skipDuplicates: true }) as any, linkRows, 1000);
  }

  const profRowsDb = await prisma.studentProfile.findMany({ select: { userId: true, lrn: true, sectionId: true, gradeLevel: true } });
  const profileByUser = new Map<string, RosterCtx["profiles"][number]>();
  for (const p of profRowsDb) {
    // Find roster ability via LRN match, fallback average.
    const roster = rosterAll.find((r) => r.lrn === p.lrn);
    const ab = roster ? rosterAbility.get(roster.id) : { ability: 0.7, attendRate: 0.92 };
    const rec = { ...p, ability: ab?.ability ?? 0.7, attendRate: ab?.attendRate ?? 0.92 };
    profiles.push(rec);
    profileByUser.set(p.userId, rec);
  }
  // Parent links for notify phase.
  if (!parentByStudent.size) {
    const links = await prisma.parentStudentLink.findMany({ select: { parentId: true, studentId: true } });
    for (const l of links) parentByStudent.set(l.studentId, l.parentId);
  }

  void MALE_FIRST;
  void FEMALE_FIRST;
  void LAST;
  void MI;
  void abilityFor;
  void attendRateFor;

  console.log(`Roster: total=${rosterAll.length} profiles=${profiles.length} rosterOnly=${rosterAll.length - profiles.length}`);
  return { rosterAll, rosterById, profiles, profileByUser, rosterAbility, parentByStudent };
}
