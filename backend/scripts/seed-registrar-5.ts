import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, type GradeLevel, type LockStatus } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { remarksFromTransmuted, transmuteGrade } from "../src/services/grading.js";
import { mascotForUnique, sectionTakenMascots } from "../src/services/mascot.js";

// Seeds the registrar desk (G11–12 band) with demo data — five rows for every
// desk page, mirroring scripts/seed-record-keeper-*.ts for the sibling desk:
//   - /registrar/accounts        → 5 pending student sign-ups
//   - /registrar/adviser-access  → 5 adviser SF10 access requests
//   - /registrar/final-grades    → 5 complete final-grade sets
//   - /registrar/sf10            → 5 SF10 records
//   - /registrar/overview        → aggregates from the rows above
// Idempotent and additive: re-runs skip anything already created and never
// delete or overwrite existing rows.
// Run: npx tsx scripts/seed-registrar-5.ts

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const GRADE_BAND: GradeLevel[] = ["G11", "G12"];
const STUDENT_PASSWORD = "Student2025!";
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

// Pending sign-ups (accounts page). Fixed emails keep re-runs idempotent;
// sections are handed out round-robin so more than one section gets one.
const PENDING_SIGNUPS = [
  { email: "pending.registrar.1@zentra.test", name: "Marisol B. Estrada", gender: "Female", birthdate: "2009-03-14" },
  { email: "pending.registrar.2@zentra.test", name: "Ferdinand C. Villamor", gender: "Male", birthdate: "2009-07-22" },
  { email: "pending.registrar.3@zentra.test", name: "Emilio G. Aguinaldo", gender: "Male", birthdate: "2008-02-19" },
  { email: "pending.registrar.4@zentra.test", name: "Liwayway P. Silang", gender: "Female", birthdate: "2008-06-30" },
  { email: "pending.registrar.5@zentra.test", name: "Corazon D. Malaya", gender: "Female", birthdate: "2009-11-02" },
];

// Active learners (final-grades + SF10 pages). They claim the first free
// G11–12 roster rows (round-robin across sections) so the account breakdown
// counts them as registered rather than orphan profiles.
const ACTIVE_EMAILS = [1, 2, 3, 4, 5].map((n) => `student.registrar.${n}@zentra.test`);

// Adviser SF10 access requests (adviser-access page) — one per shape the desk
// can act on: untouched, checked, checked + reported-missing, approved, denied.
type RequestPlan = {
  sectionName: string;
  adviserEmail: string;
  status: "pending" | "approved" | "denied";
  /** How many advisee LRNs to pick; 0 = whole section. */
  pickCount: number;
  checked: boolean;
  requestedDaysAgo: number;
  decidedDaysAgo?: number;
  reportMissingLast?: boolean;
  denyReason?: string;
  reason: string;
};
const REQUEST_PLAN: RequestPlan[] = [
  {
    sectionName: "Mendel",
    adviserEmail: "adviser.g11.a@zentra.test",
    status: "pending" as const,
    pickCount: 3,
    checked: false,
    requestedDaysAgo: 0.3,
    reason:
      "Cross-checking SF10 entries against the uploaded learner documents before endorsing the term grades.",
  },
  {
    sectionName: "Mendel",
    adviserEmail: "adviser.g11.b@zentra.test",
    status: "pending" as const,
    pickCount: 0, // whole section
    checked: true,
    reportMissingLast: true,
    requestedDaysAgo: 1.4,
    reason:
      "Advisory clearance review — I need the section's SF10 attached/missing status before signing clearance forms.",
  },
  {
    sectionName: "Pasteur",
    adviserEmail: "adviser.g11.c@zentra.test",
    status: "pending" as const,
    pickCount: 4,
    checked: true,
    requestedDaysAgo: 2.6,
    reason: "Verifying records of advisees with incomplete documentary requirements.",
  },
  {
    sectionName: "Archimedes",
    adviserEmail: "adviser.g12.a@zentra.test",
    status: "approved" as const,
    pickCount: 3,
    checked: true,
    requestedDaysAgo: 4.2,
    decidedDaysAgo: 3.1,
    reason: "Graduation clearance packet — confirming no unresolved SF10 records for my advisees.",
  },
  {
    sectionName: "Aristotle",
    adviserEmail: "adviser.g12.b@zentra.test",
    status: "denied" as const,
    pickCount: 2,
    checked: true,
    requestedDaysAgo: 6.5,
    decidedDaysAgo: 5.2,
    denyReason: "Anecdotal attachments are not part of the SF10 record; access denied for the stated purpose.",
    reason: "Requesting SF10 read to review anecdotal attachments filed with the records.",
  },
];

// SF10 record shapes (sf10 page). One is validated (available) and one already
// released so the lifecycle chips and overview feed carry every stage.
type Sf10Plan = {
  status: "attach" | "available" | "released";
  source: "manual" | "ocr_upload" | "auto_populated";
  uploadDaysAgo: number;
  verifyDaysAgo: number;
  validateDaysAgo: number;
  releaseDaysAgo?: number;
  ocr: boolean;
};
const SF10_PLAN: Sf10Plan[] = [
  { status: "attach", source: "manual", uploadDaysAgo: 4, verifyDaysAgo: 3, validateDaysAgo: 2, ocr: false },
  { status: "attach", source: "ocr_upload", uploadDaysAgo: 6, verifyDaysAgo: 5, validateDaysAgo: 4, ocr: true },
  { status: "attach", source: "auto_populated", uploadDaysAgo: 9, verifyDaysAgo: 8, validateDaysAgo: 8, ocr: false },
  { status: "available", source: "manual", uploadDaysAgo: 12, verifyDaysAgo: 10, validateDaysAgo: 7, ocr: false },
  { status: "released", source: "ocr_upload", uploadDaysAgo: 15, verifyDaysAgo: 13, validateDaysAgo: 10, releaseDaysAgo: 2, ocr: true },
];

type ActiveStudent = {
  userId: string;
  lrn: string;
  fullName: string;
  gradeLevel: GradeLevel;
  sectionId: string;
  sectionName: string;
};

/** Round-robin one pick per list until `count` picks are made. */
function roundRobin<T>(lists: T[][], count: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < count; i++) {
    let moved = false;
    for (const list of lists) {
      if (list[i] !== undefined) {
        out.push(list[i]!);
        moved = true;
        if (out.length === count) break;
      }
    }
    if (!moved) break;
  }
  return out;
}

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!year) return console.log("No active school year — aborting.");

  const terms = await prisma.term.findMany({ where: { schoolYearId: year.id }, orderBy: { termNumber: "asc" } });
  const now = Date.now();
  const term =
    terms.find((t) => t.startDate && t.endDate && t.startDate.getTime() <= now && now <= t.endDate.getTime()) ??
    terms.find((t) => t.termNumber === 2) ??
    terms[0];
  if (!term) return console.log("No terms for the active school year — aborting.");

  const sections = await prisma.section.findMany({
    where: { schoolYearId: year.id, gradeLevel: { in: GRADE_BAND } },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    select: { id: true, name: true, gradeLevel: true },
  });
  if (sections.length === 0) return console.log("No G11–12 sections for the active school year — aborting.");

  const subjects = await prisma.subject.findMany({
    where: { gradeLevel: { in: GRADE_BAND } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, gradeLevel: true },
  });
  const subjectsByGrade = new Map<string, typeof subjects>();
  for (const s of subjects) {
    const list = subjectsByGrade.get(s.gradeLevel) ?? [];
    list.push(s);
    subjectsByGrade.set(s.gradeLevel, list);
  }

  const registrar =
    (await prisma.user.findFirst({ where: { role: "registrar" }, orderBy: { createdAt: "asc" } })) ?? null;
  if (!registrar) return console.log("No registrar account found — aborting (seed stamps need a decided-by user).");

  const advisers = await prisma.user.findMany({
    where: { role: "adviser" },
    orderBy: { email: "asc" },
    select: { id: true, email: true, fullName: true },
  });
  const teachers = await prisma.user.findMany({
    where: { role: "subject_teacher" },
    orderBy: { email: "asc" },
    select: { id: true },
  });

  const hash = await argon2.hash(STUDENT_PASSWORD);
  const profileLrns = new Set((await prisma.studentProfile.findMany({ select: { lrn: true } })).map((p) => p.lrn));
  const usedLrn = new Set(profileLrns);
  for (const r of await prisma.studentRoster.findMany({ select: { lrn: true } })) usedLrn.add(r.lrn);

  // -------------------------------------------------------------------------
  // 1. Active learners — five G11–12 roster rows get real accounts
  // -------------------------------------------------------------------------
  const rosterRows = await prisma.studentRoster.findMany({
    where: { gradeLevel: { in: GRADE_BAND }, schoolYearId: year.id },
    orderBy: [{ section: { name: "asc" } }, { fullName: "asc" }],
    select: { lrn: true, fullName: true, gradeLevel: true, sectionId: true, section: { select: { name: true } } },
  });
  const bySection = new Map<string, typeof rosterRows>();
  for (const r of rosterRows) {
    if (profileLrns.has(r.lrn)) continue; // already has an account
    const list = bySection.get(r.sectionId) ?? [];
    list.push(r);
    bySection.set(r.sectionId, list);
  }
  const picked = roundRobin([...bySection.values()], ACTIVE_EMAILS.length);

  const activeStudents: ActiveStudent[] = [];
  let finalsRows = 0;
  let adviserApprovedSets = 0;
  let lockedSets = 0;
  const finalsByStudent = new Map<string, Map<string, number>>();

  for (let i = 0; i < Math.min(picked.length, ACTIVE_EMAILS.length); i++) {
    const email = ACTIVE_EMAILS[i]!;
    const row = picked[i]!;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        studentProfile: {
          select: { lrn: true, gradeLevel: true, sectionId: true, section: { select: { name: true } } },
        },
        fullName: true,
      },
    });
    if (existing) {
      console.log(`active learner ${i + 1}: ${email} already seeded — skip`);
      if (existing.studentProfile?.sectionId) {
        activeStudents.push({
          userId: existing.id,
          lrn: existing.studentProfile.lrn,
          fullName: existing.fullName,
          gradeLevel: existing.studentProfile.gradeLevel,
          sectionId: existing.studentProfile.sectionId,
          sectionName: existing.studentProfile.section?.name ?? "—",
        });
      }
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email,
        fullName: row.fullName,
        role: "student",
        status: "active",
        passwordHash: hash,
        contactNumber: `+63 917 555 02${i}0`,
        createdAt: ago(45 + i),
      },
    });
    const taken = new Set(await sectionTakenMascots(prisma, row.sectionId));
    const mascot = mascotForUnique(row.fullName, row.lrn, taken);
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        lrn: row.lrn,
        gradeLevel: row.gradeLevel,
        sectionId: row.sectionId,
        mascot,
        gender: i % 2 === 0 ? "Female" : "Male",
        birthdate: new Date(row.gradeLevel === "G11" ? "2009-05-08" : "2008-08-21"),
        address: "Mati City, Davao Oriental",
      },
    });
    activeStudents.push({
      userId: user.id,
      lrn: row.lrn,
      fullName: row.fullName,
      gradeLevel: row.gradeLevel,
      sectionId: row.sectionId,
      sectionName: row.section.name,
    });

    // -----------------------------------------------------------------------
    // 2. Final grades — every subject of the learner's grade, term-scoped.
    //    Sets 1–3 are adviser-approved (complete), sets 4–5 stay at the
    //    subject-teacher "locked" stage so the pipeline shows both steps.
    // -----------------------------------------------------------------------
    const lockStatus: LockStatus = i < 3 ? "adviser_approved" : "locked";
    if (lockStatus === "adviser_approved") adviserApprovedSets++;
    else lockedSets++;

    const gradeSubjects = subjectsByGrade.get(row.gradeLevel) ?? [];
    const rows: any[] = [];
    const grades = new Map<string, number>();
    gradeSubjects.forEach((subj, j) => {
      const avg = 82 + ((i * 2 + j * 3) % 11); // 82..92, deterministic spread
      const tg = transmuteGrade(avg);
      grades.set(subj.id, tg);
      rows.push({
        id: `reg_fg_${user.id}_${subj.id}_${term.id}`,
        studentId: user.id,
        subjectId: subj.id,
        termId: term.id,
        computedAverage: avg,
        transmutedGrade: tg,
        remarks: remarksFromTransmuted(tg),
        lockStatus,
        lockedAt: lockStatus === "locked" ? ago(1.5 + i * 0.4) : null,
        adviserApprovedAt: lockStatus === "adviser_approved" ? ago(1 + i * 0.4) : null,
        adviserApprovedBy: registrar.id,
      });
    });
    if (rows.length > 0) {
      await prisma.finalGrade.createMany({ data: rows, skipDuplicates: true });
      finalsRows += rows.length;
    }
    finalsByStudent.set(user.id, grades);
  }

  console.log(
    `Final grades: ${finalsRows} subject rows → ${adviserApprovedSets} adviser-approved + ${lockedSets} locked sets`,
  );

  // -------------------------------------------------------------------------
  // 3. Teacher assignments for the term so grade sets show their subject
  //    teachers (same reason the record-keeper finals script creates them).
  // -------------------------------------------------------------------------
  let tsaCreated = 0;
  if (teachers.length > 0) {
    const tsa: any[] = [];
    for (const section of sections) {
      const gradeSubjects = subjectsByGrade.get(section.gradeLevel) ?? [];
      gradeSubjects.forEach((subj, idx) => {
        tsa.push({
          id: `reg_tsa_${section.id}_${subj.id}_${term.id}`,
          teacherId: teachers[idx % teachers.length]!.id,
          subjectId: subj.id,
          sectionId: section.id,
          termId: term.id,
        });
      });
    }
    if (tsa.length > 0) {
      const ids = tsa.map((t) => t.id as string);
      const before = await prisma.teacherSubjectAssignment.count({ where: { id: { in: ids } } });
      await prisma.teacherSubjectAssignment.createMany({ data: tsa, skipDuplicates: true });
      tsaCreated = ids.length - before;
    }
  }
  console.log(`Teacher assignments: ${tsaCreated} subject×section rows for term ${term.termNumber}`);

  // -------------------------------------------------------------------------
  // 4. SF10 records — one per active learner, staged across the lifecycle
  // -------------------------------------------------------------------------
  let sf10Created = 0;
  let sf10Attach = 0;
  for (let i = 0; i < activeStudents.length; i++) {
    const student = activeStudents[i]!;
    const plan = SF10_PLAN[i % SF10_PLAN.length]!;
    const existing = await prisma.sf10Record.findUnique({
      where: { studentId_desk: { studentId: student.userId, desk: "registrar" } },
      select: { id: true },
    });
    if (existing) {
      console.log(`SF10 ${i + 1}: ${student.fullName} already has a registrar record — skip`);
      continue;
    }
    const gradeSubjects = subjectsByGrade.get(student.gradeLevel) ?? [];
    const grades = finalsByStudent.get(student.userId) ?? new Map<string, number>();
    const grade = (subjectId: string) => grades.get(subjectId) ?? 85;

    await prisma.sf10Record.create({
      data: {
        id: `reg_sf10_${student.userId}`,
        studentId: student.userId,
        desk: "registrar",
        source: plan.source as any,
        status: plan.status as any,
        uploadedFileUrl:
          plan.source === "auto_populated" ? null : `https://example.com/sf10/${student.lrn}.pdf`,
        ocrExtractedData: plan.ocr
          ? {
              ocrAt: ago(plan.uploadDaysAgo).toISOString(),
              engine: "local-pdf-text-v1",
              learner: {
                lrn: student.lrn,
                suffix: null,
                fullName: student.fullName,
                confidence: 0.95,
              },
              subjects: gradeSubjects.map((s) => ({
                norm: s.name.toLowerCase(),
                grade: grade(s.id),
                rating: grade(s.id),
                rawName: s.name,
                remarks: "PASSED",
                quarters: [grade(s.id), grade(s.id), grade(s.id), grade(s.id)],
                gradeLevel: student.gradeLevel,
              })),
              ocrStatus: "ready",
              confidence: 0.9,
              needsReview: false,
            }
          : undefined,
        verifiedBy: registrar.id,
        verifiedAt: ago(plan.verifyDaysAgo),
        validatedBy: registrar.id,
        validatedAt: ago(plan.validateDaysAgo),
        releasedAt: plan.status === "released" ? ago(plan.releaseDaysAgo ?? 2) : null,
        uploadedAt: ago(plan.uploadDaysAgo),
        currentVersion: plan.status === "released" ? 2 : 1,
      },
    });
    await prisma.sf10RecordVersion.create({
      data: {
        sf10RecordId: `reg_sf10_${student.userId}`,
        versionNumber: 1,
        dataSnapshot: { learner: { lrn: student.lrn, fullName: student.fullName }, seeded: true },
        changedBy: registrar.id,
        changeReason: plan.ocr ? "SF10 upload (learner read from file)" : "SF10 upload (record attached)",
      },
    });
    if (plan.status === "released") {
      await prisma.sf10RecordVersion.create({
        data: {
          sf10RecordId: `reg_sf10_${student.userId}`,
          versionNumber: 2,
          dataSnapshot: { learner: { lrn: student.lrn, fullName: student.fullName }, released: true },
          changedBy: registrar.id,
          changeReason: "Re-validation before release",
        },
      });
    }
    if (plan.status === "attach") sf10Attach++;
    sf10Created++;
  }
  console.log(`SF10 records: +${sf10Created} (desk=registrar, ${sf10Attach} attached)`);

  // -------------------------------------------------------------------------
  // 5. Adviser SF10 access requests — full verdict mix for the review queue
  // -------------------------------------------------------------------------
  const profilesBySection = new Map<string, string[]>();
  for (const p of await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: GRADE_BAND } },
    select: { lrn: true, sectionId: true },
    orderBy: { lrn: "asc" },
  })) {
    if (!p.sectionId) continue;
    const list = profilesBySection.get(p.sectionId) ?? [];
    list.push(p.lrn);
    profilesBySection.set(p.sectionId, list);
  }
  const rosterBySection = new Map<string, string[]>();
  for (const r of await prisma.studentRoster.findMany({
    where: { gradeLevel: { in: GRADE_BAND }, schoolYearId: year.id },
    select: { lrn: true, sectionId: true },
    orderBy: { lrn: "asc" },
  })) {
    const list = rosterBySection.get(r.sectionId) ?? [];
    list.push(r.lrn);
    rosterBySection.set(r.sectionId, list);
  }

  let requestsCreated = 0;
  for (let i = 0; i < REQUEST_PLAN.length; i++) {
    const plan = REQUEST_PLAN[i]!;
    const section = sections.find((s) => s.name === plan.sectionName);
    if (!section) {
      console.log(`request ${i + 1}: section ${plan.sectionName} not found — skip`);
      continue;
    }
    const adviser = advisers.find((a) => a.email === plan.adviserEmail) ?? advisers[i % advisers.length];
    if (!adviser) {
      console.log(`request ${i + 1}: no adviser account available — skip`);
      continue;
    }
    const duplicate = await prisma.adviserSf10AccessRequest.count({
      where: { adviserId: adviser.id, sectionId: section.id },
    });
    if (duplicate > 0) {
      console.log(`request ${i + 1}: ${adviser.fullName} → ${section.name} already exists — skip`);
      continue;
    }

    const sectionLrns = [
      ...new Set([...(profilesBySection.get(section.id) ?? []), ...(rosterBySection.get(section.id) ?? [])]),
    ].sort();
    const preferred = activeStudents.filter((s) => s.sectionId === section.id).map((s) => s.lrn);
    const pickOrder = [...new Set([...preferred, ...sectionLrns])];
    const requestedLrns = plan.pickCount === 0 ? [] : pickOrder.slice(0, plan.pickCount);
    const rows = requestedLrns.length > 0 ? requestedLrns : sectionLrns;

    const checkedAt = plan.checked ? ago(plan.requestedDaysAgo - 0.15) : null;
    let checkSummary: { total: number; has: number; missing: number } | null = null;
    if (plan.checked) {
      const hits = await prisma.studentProfile.findMany({
        where: { lrn: { in: rows }, sf10Records: { some: {} } },
        select: { lrn: true },
      });
      checkSummary = { total: rows.length, has: hits.length, missing: rows.length - hits.length };
    }

    const reported: string[] = [];
    if (plan.reportMissingLast) {
      const missingCandidate =
        [...rows].reverse().find((lrn) => !activeStudents.some((s) => s.lrn === lrn)) ?? rows[rows.length - 1];
      if (missingCandidate) reported.push(missingCandidate);
    }

    const decidedAt = plan.status === "pending" ? null : ago(plan.decidedDaysAgo ?? plan.requestedDaysAgo - 0.2);
    const approvedLrns = plan.status === "approved" ? [...requestedLrns] : [];
    const approvedLrnAt =
      approvedLrns.length > 0
        ? Object.fromEntries(approvedLrns.map((lrn) => [lrn, (decidedAt ?? new Date()).toISOString()]))
        : undefined;

    await prisma.adviserSf10AccessRequest.create({
      data: {
        id: `reg_asr_${section.id}_${i + 1}`,
        adviserId: adviser.id,
        sectionId: section.id,
        gradeLevel: section.gradeLevel,
        reason: plan.reason,
        requestedLrns,
        checkedAt,
        checkedBy: plan.checked ? registrar.id : null,
        checkSummary: checkSummary ?? undefined,
        reportedMissingLrns: reported,
        reportedLrnAt:
          reported.length > 0
            ? Object.fromEntries(reported.map((lrn) => [lrn, new Date().toISOString()]))
            : undefined,
        approvedLrns,
        approvedLrnAt,
        status: plan.status,
        decidedBy: plan.status === "pending" ? null : registrar.id,
        decidedAt,
        decisionReason: plan.status === "denied" ? plan.denyReason : null,
        requestedAt: ago(plan.requestedDaysAgo),
      },
    });
    requestsCreated++;
  }
  console.log(`Adviser access requests: +${requestsCreated}`);

  // -------------------------------------------------------------------------
  // 6. Pending student accounts — five sign-ups awaiting registrar approval,
  //    with matching roster rows so LRN verification resolves to a match.
  // -------------------------------------------------------------------------
  let pendingCreated = 0;
  let lrnSeed = 850000001;
  for (let i = 0; i < PENDING_SIGNUPS.length; i++) {
    const slot = PENDING_SIGNUPS[i]!;
    const existing = await prisma.user.findUnique({ where: { email: slot.email }, select: { id: true } });
    if (existing) {
      console.log(`pending slot ${i + 1}: ${slot.email} already seeded — skip`);
      continue;
    }
    const section = sections[i % sections.length]!;
    let lrn: string;
    do {
      lrn = `20${String(lrnSeed++).padStart(9, "0")}`;
    } while (usedLrn.has(lrn));
    usedLrn.add(lrn);

    const user = await prisma.user.create({
      data: {
        email: slot.email,
        fullName: slot.name,
        role: "student",
        status: "pending",
        passwordHash: hash,
        contactNumber: `+63 917 555 03${i}0`,
        createdAt: ago(i + 1),
      },
    });
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        lrn,
        gradeLevel: section.gradeLevel,
        sectionId: section.id,
        birthdate: new Date(slot.birthdate),
        gender: slot.gender,
        address: "Mati City, Davao Oriental",
      },
    });
    await prisma.studentRoster.upsert({
      where: { lrn_schoolYearId: { lrn, schoolYearId: year.id } },
      update: { fullName: slot.name, gradeLevel: section.gradeLevel, sectionId: section.id },
      create: {
        lrn,
        fullName: slot.name,
        gradeLevel: section.gradeLevel,
        sectionId: section.id,
        schoolYearId: year.id,
      },
    });
    pendingCreated++;
  }
  console.log(`Pending student accounts: +${pendingCreated}`);

  // -------------------------------------------------------------------------
  // 7. Accounts activity log — approval audit entries for the active learners
  //    (the accounts page's "Recent account activity" panel reads these).
  // -------------------------------------------------------------------------
  let auditCreated = 0;
  const existingAudit = await prisma.auditLog.count({ where: { id: { startsWith: "reg_audit_" } } });
  if (existingAudit === 0 && activeStudents.length > 0) {
    const nowIso = new Date().toISOString();
    await prisma.auditLog.createMany({
      data: activeStudents.map((s, i) => ({
        id: `reg_audit_${s.userId}`,
        userId: registrar.id,
        actionType: "account_approval" as const,
        sourceTable: "users",
        sourceId: s.userId,
        reason: "Account activated",
        oldValue: { status: "pending" },
        newValue: { status: "active", approvedAt: nowIso },
        createdAt: ago(44 + i),
      })),
      skipDuplicates: true,
    });
    auditCreated = activeStudents.length;
  }
  console.log(`Accounts activity (audit): +${auditCreated}`);

  console.log(`
Registrar desk seed complete (${year.name} · term ${term.termNumber}):
  - /registrar/accounts       → ${pendingCreated} pending sign-ups + ${auditCreated} activity entries
  - /registrar/adviser-access → ${requestsCreated} access requests (pending / approved / denied mix)
  - /registrar/final-grades   → ${adviserApprovedSets + lockedSets} complete sets over ${finalsRows} subject rows
  - /registrar/sf10           → ${sf10Created} records (${sf10Attach} attached, rest validated/released)
  - /registrar/overview       → aggregates from the rows above`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
