import { PrismaClient, Role, GradeLevel, ComponentType, AttendanceStatus, Session, Remarks, RiskLevel, Confidentiality, ReferralTarget, ReferralStatus, ApprovalStatus, OutcomeStatus, AdmEligibility, AdmFormType, AdmFormStatus, Sf10Source, ActionType, NotifChannel, LockStatus } from "@prisma/client";
import { recomputeRisk, evaluateRisk } from "../src/services/risk.js";
import argon2 from "argon2";

const prisma = new PrismaClient();

const STAFF_PASSWORD = "Zentra2025!";
const STUDENT_PASSWORD = "Student2025!";
const PARENT_PASSWORD = "Parent2025!";

const GRADE_LEVELS: GradeLevel[] = ["G7", "G8", "G9", "G10", "G11", "G12"];
const SECTION_NAMES = ["A", "B", "C"];
const STUDENTS_PER_SECTION = 20;
const MIN_RECORDS = 20;

const SUBJECT_NAMES: Record<GradeLevel, { name: string; code: string }[]> = {
  G7: [{ name: "Math 7", code: "MATH7" }, { name: "English 7", code: "ENG7" }, { name: "Science 7", code: "SCI7" }],
  G8: [{ name: "Math 8", code: "MATH8" }, { name: "English 8", code: "ENG8" }, { name: "Science 8", code: "SCI8" }],
  G9: [{ name: "Math 9", code: "MATH9" }, { name: "English 9", code: "ENG9" }, { name: "Science 9", code: "SCI9" }],
  G10: [{ name: "Math 10", code: "MATH10" }, { name: "English 10", code: "ENG10" }, { name: "Science 10", code: "SCI10" }],
  G11: [{ name: "Gen Math 11", code: "GMM11" }, { name: "Purposive Comm 11", code: "PC11" }, { name: "Earth Sci 11", code: "ES11" }],
  G12: [{ name: "Calc 12", code: "CALC12" }, { name: "Research 12", code: "RES12" }, { name: "Physics 12", code: "PHY12" }],
};

const FIRST_NAMES = ["Maria", "Juan", "Ana", "Pedro", "Sofia", "Lucas", "Elena", "Miguel", "Rosa", "Jose", "Carmen", "Antonio", "Lucia", "Diego", "Gabriela", "Andres", "Isabella", "Rafael", "Paula", "Manuel", "Teresa", "Francisco", "Liza", "Carlos"];
const LAST_NAMES = ["Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Flores", "Ramos", "Diaz", "Castillo", "Manalo", "Bautista", "Villanueva", "Ocampo", "Aquino", "Delos Reyes", "Gonzales", "Ferrer", "Tanjuan", "Salazar"];
const INCIDENTS = ["Disruptive behavior during class discussion", "Late submission of assignments for three consecutive days", "Verbal altercation with a classmate during recess", "Incomplete homework without prior notice", "Sleeping during morning session", "Unauthorized use of mobile phone in class"];
const COMPLAINTS = ["Mild fever and headache", "Stomach ache after lunch", "Minor abrasion on knee from P.E.", "Cough and sore throat", "Dizziness during flag ceremony"];
const DIAGNOSES = ["Viral fever, advised rest and hydration", "Acute gastritis, advised dietary monitoring", "Superficial abrasion, cleaned and dressed", "Pharyngitis, advised rest", "Mild dehydration, advised fluid intake"];
const OCCUPATIONS = ["Teacher", "Engineer", "Nurse", "Vendor", "Driver", "Accountant"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickDate(sy: number, sm: number, em: number): Date { return new Date(sy, randInt(sm, em) - 1, randInt(1, 28), randInt(7, 16), randInt(0, 59)); }
// Term-scoped dates: within SY 2026-2027 Term 1, but never in the future —
// from the term start (Jun 15) up to "now" (clamped to the term end).
function inTermDate(): Date {
  const start = new Date(2026, 5, 20, 7, 0, 0).getTime(); // Jun 20 2026 (safely inside term start)
  const end = Math.min(Date.now(), new Date(2026, 9, 31, 23, 59, 59).getTime()); // now, capped at Oct 31
  const t = start + Math.random() * Math.max(0, end - start);
  return new Date(t);
}
function id(prefix: string): string { return `${prefix}_${Math.random().toString(36).slice(2, 12)}`; }
// Deterministic id derived from a stable key so re-runs reuse existing rows
// instead of generating fresh random ids that dangle from FK constraints.
function keyId(prefix: string, key: string): string { return `${prefix}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`; }

const STAFF_ACCOUNTS = [
  { email: "principal@zentra.test", fullName: "Default Principal", role: "principal" as Role },
  { email: "registrar@zentra.test", fullName: "Default Registrar", role: "registrar" as Role },
  { email: "record_keeper@zentra.test", fullName: "Default Record Keeper", role: "record_keeper" as Role },
  { email: "nurse@zentra.test", fullName: "Default Nurse", role: "nurse" as Role },
  { email: "guidance@zentra.test", fullName: "Default Guidance Counselor", role: "guidance_counselor" as Role },
  { email: "adm@zentra.test", fullName: "Default ADM Coordinator", role: "adm_coordinator" as Role },
];

async function main() {
  const staffHash = await argon2.hash(STAFF_PASSWORD);
  const studentHash = await argon2.hash(STUDENT_PASSWORD);
  const parentHash = await argon2.hash(PARENT_PASSWORD);

  // Staff accounts (keyed by email; capture real ids)
  for (const a of STAFF_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" },
      create: { email: a.email, fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" },
    });
  }
  const principal = await prisma.user.findUniqueOrThrow({ where: { email: "principal@zentra.test" } });
  const registrarUser = await prisma.user.findUniqueOrThrow({ where: { email: "registrar@zentra.test" } });
  const nurse = await prisma.user.findUniqueOrThrow({ where: { email: "nurse@zentra.test" } });
  const guidance = await prisma.user.findUniqueOrThrow({ where: { email: "guidance@zentra.test" } });
  const admCoord = await prisma.user.findUniqueOrThrow({ where: { email: "adm@zentra.test" } });

  let schoolYear = await prisma.schoolYear.findFirst({ where: { name: "SY 2026-2027" } });
  if (!schoolYear) schoolYear = await prisma.schoolYear.create({ data: { name: "SY 2026-2027", startDate: new Date("2026-06-15"), endDate: new Date("2027-03-31"), isActive: true, createdBy: principal.id } });

  const term = await prisma.term.upsert({
    where: { schoolYearId_termNumber: { schoolYearId: schoolYear.id, termNumber: 1 } },
    update: {},
    create: { schoolYearId: schoolYear.id, termNumber: 1, startDate: new Date("2026-06-15"), endDate: new Date("2026-10-31") },
  });

  // Subjects
  const subjectIds: Record<string, string> = {};
  const subjectData: { id: string; name: string; code: string; gradeLevel: GradeLevel }[] = [];
  for (const grade of GRADE_LEVELS) for (const s of SUBJECT_NAMES[grade]) subjectData.push({ id: id("subj"), name: s.name, code: s.code, gradeLevel: grade });
  await prisma.subject.createMany({ data: subjectData, skipDuplicates: true });
  for (const grade of GRADE_LEVELS) for (const s of SUBJECT_NAMES[grade]) {
    const rec = await prisma.subject.findUniqueOrThrow({ where: { code: s.code } });
    subjectIds[`${grade}:${s.code}`] = rec.id;
  }

  // Sections + advisers + students + parents + sf10. Users created individually to capture real ids.
  const sections: { id: string; gradeLevel: GradeLevel; name: string; adviserId: string }[] = [];
  const studentProfiles: { userId: string; lrn: string; gradeLevel: GradeLevel; sectionId: string; birthdate: Date; address: string }[] = [];
  const parentProfiles: { userId: string; address: string; occupation: string }[] = [];
  const parentLinks: { id: string; parentId: string; studentId: string; relationship: string; approvedBy: string }[] = [];
  const sf10: { id: string; studentId: string; source: Sf10Source; verifiedBy: string; validatedBy: string; currentVersion: number }[] = [];

  let adviserCounter = 0;
  for (const grade of GRADE_LEVELS) {
    for (const secName of SECTION_NAMES) {
      adviserCounter++;
      const adviserEmail = `adviser.${grade.toLowerCase()}.${secName.toLowerCase()}@zentra.test`;
      const adviser = await prisma.user.upsert({
        where: { email: adviserEmail },
        update: { fullName: `Adviser ${grade}-${secName}`, role: "adviser" as Role, passwordHash: staffHash, status: "active" },
        create: { email: adviserEmail, fullName: `Adviser ${grade}-${secName}`, role: "adviser" as Role, passwordHash: staffHash, status: "active" },
      });
      const empId = `ADV${String(adviserCounter).padStart(3, "0")}`;
      await prisma.staffProfile.upsert({ where: { userId: adviser.id }, update: { employeeId: empId, isAdviser: true, department: "Academic" }, create: { userId: adviser.id, employeeId: empId, isAdviser: true, department: "Academic" } });

      const sectionId = `sec-${grade}-${secName}`;
      await prisma.section.upsert({ where: { id: sectionId }, update: { name: `${grade}-${secName}`, gradeLevel: grade, schoolYearId: schoolYear.id, adviserId: adviser.id }, create: { id: sectionId, name: `${grade}-${secName}`, gradeLevel: grade, schoolYearId: schoolYear.id, adviserId: adviser.id } });
      sections.push({ id: sectionId, gradeLevel: grade, name: `${grade}-${secName}`, adviserId: adviser.id });

      for (let i = 1; i <= STUDENTS_PER_SECTION; i++) {
        const fullName = `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
        const sEmail = `student.${grade.toLowerCase()}.${secName.toLowerCase()}.${i}@zentra.test`;
        const student = await prisma.user.upsert({
          where: { email: sEmail },
          update: { fullName, role: "student" as Role, passwordHash: studentHash, status: "active" },
          create: { email: sEmail, fullName, role: "student" as Role, passwordHash: studentHash, status: "active" },
        });
        const lrn = `20${String(randInt(100000000, 999999999)).padStart(9, "0")}`;
        studentProfiles.push({ userId: student.id, lrn, gradeLevel: grade, sectionId, birthdate: pickDate(2010, 1, 12), address: `${randInt(1, 999)} ${rand(LAST_NAMES)} St., Quezon City` });

        const pEmail = `parent.${grade.toLowerCase()}.${secName.toLowerCase()}.${i}@zentra.test`;
        const parent = await prisma.user.upsert({
          where: { email: pEmail },
          update: { fullName: `Parent of ${fullName}`, role: "parent" as Role, passwordHash: parentHash, status: "active" },
          create: { email: pEmail, fullName: `Parent of ${fullName}`, role: "parent" as Role, passwordHash: parentHash, status: "active" },
        });
        parentProfiles.push({ userId: parent.id, address: `${randInt(1, 999)} ${rand(LAST_NAMES)} St., Quezon City`, occupation: rand(OCCUPATIONS) });
        parentLinks.push({ id: id("psl"), parentId: parent.id, studentId: student.id, relationship: "Guardian", approvedBy: adviser.id });
        sf10.push({ id: id("sf10"), studentId: student.id, source: "auto_populated" as Sf10Source, verifiedBy: registrarUser.id, validatedBy: registrarUser.id, currentVersion: 1 });
      }
    }
  }

  await prisma.studentProfile.createMany({ data: studentProfiles, skipDuplicates: true });
  await prisma.parentProfile.createMany({ data: parentProfiles, skipDuplicates: true });
  await prisma.parentStudentLink.createMany({ data: parentLinks, skipDuplicates: true });
  await prisma.sf10Record.createMany({ data: sf10, skipDuplicates: true });

  const allStudents = studentProfiles.map((s) => ({ userId: s.userId, sectionId: s.sectionId, gradeLevel: s.gradeLevel }));
  const totalStudents = allStudents.length;

  // Teacher assignments (per section/subject/term), grade components + assessments (per subject+term,
  // matching the schema unique (subjectId, termId, componentType)), and grades for all students in the grade.
  const teacherAssignments: { id: string; teacherId: string; subjectId: string; sectionId: string; termId: string }[] = [];
  const studentGrades: { id: string; assessmentId: string; studentId: string; rawScore: number; percentageScore: number }[] = [];
  const finalGrades: { id: string; studentId: string; subjectId: string; termId: string; computedAverage: number; transmutedGrade: number; remarks: Remarks; lockStatus: LockStatus }[] = [];
  // G11–G12 final-grade ids that advisers have already "locked" (so the registrar
  // Final Grade Approvals screen has live data to validate). ~60% of G11–G12 rows.
  const lockedFinalGradeIds: string[] = [];

  const componentTypes: ComponentType[] = ["WRITTEN_WORK", "PERFORMANCE_TASK", "QUARTERLY_EXAM"];

  // 1) Grade components per subject+term (school-wide). Unique (subjectId, termId, componentType).
  for (const grade of GRADE_LEVELS) {
    for (const s of SUBJECT_NAMES[grade]) {
      const subjectId = subjectIds[`${grade}:${s.code}`];
      let weight = 30;
      for (const ct of componentTypes) {
        const compWeight = ct === "QUARTERLY_EXAM" ? 40 : weight;
        await prisma.gradeComponent.upsert({
          where: { subjectId_termId_componentType: { subjectId, termId: term.id, componentType: ct } },
          update: { weightPercentage: compWeight },
          create: { subjectId, termId: term.id, componentType: ct, weightPercentage: compWeight },
        });
        weight += 15;
      }
    }
  }
  // Read back the actual persisted component ids so assessments reference real rows.
  const persistedGC = await prisma.gradeComponent.findMany({ where: { termId: term.id } });
  const gcByKey: Record<string, string> = {};
  for (const gc of persistedGC) gcByKey[`${gc.subjectId}:${gc.componentType}`] = gc.id;

  // Assessments per component (skipDuplicates on @@unique([gradeComponentId, title])).
  const assessments: { id: string; gradeComponentId: string; title: string; maxScore: number; dateGiven: Date; createdBy: string }[] = [];
  const assessByKey: Record<string, string> = {};
  for (const grade of GRADE_LEVELS) {
    for (const s of SUBJECT_NAMES[grade]) {
      const subjectId = subjectIds[`${grade}:${s.code}`];
      for (const ct of componentTypes) {
        const gcId = gcByKey[`${subjectId}:${ct}`];
        if (!gcId) continue;
        const aId = keyId("assess", `${subjectId}:${ct}`);
        assessments.push({ id: aId, gradeComponentId: gcId, title: `${ct} ${s.code}`, maxScore: 100, dateGiven: inTermDate(), createdBy: "seed" });
        assessByKey[`${subjectId}:${ct}`] = aId;
      }
    }
  }

  // 2) Teacher assignments per section/subject, and grades for every student in that grade.
  for (const section of sections) {
    for (const s of SUBJECT_NAMES[section.gradeLevel]) {
      const subjectId = subjectIds[`${section.gradeLevel}:${s.code}`];
      teacherAssignments.push({ id: id("tsa"), teacherId: section.adviserId, subjectId, sectionId: section.id, termId: term.id });
    }
  }
  for (const grade of GRADE_LEVELS) {
    for (const s of SUBJECT_NAMES[grade]) {
      const subjectId = subjectIds[`${grade}:${s.code}`];
      const gradeStudents = allStudents.filter((st) => st.gradeLevel === grade);
      for (const ct of componentTypes) {
        const aId = assessByKey[`${subjectId}:${ct}`];
        if (!aId) continue;
        for (const st of gradeStudents) {
          const raw = randInt(60, 100);
          studentGrades.push({ id: id("sg"), assessmentId: aId, studentId: st.userId, rawScore: raw, percentageScore: raw });
        }
      }
      for (const st of gradeStudents) {
        const avg = randInt(70, 98);
        const fgId = id("fg");
        // Advisers approve ~60% of G11–G12 finals (adviser_approved), so they
        // reach the registrar for final approval; all lower grades stay unlocked.
        const shouldApprove = (grade === "G11" || grade === "G12") && Math.random() < 0.6;
        if (shouldApprove) lockedFinalGradeIds.push(fgId);
        finalGrades.push({
          id: fgId,
          studentId: st.userId,
          subjectId,
          termId: term.id,
          computedAverage: avg,
          transmutedGrade: avg,
          remarks: avg >= 75 ? ("Passed" as Remarks) : ("Failed" as Remarks),
          lockStatus: shouldApprove ? ("adviser_approved" as LockStatus) : ("unlocked" as LockStatus),
        });
      }
    }
  }
  await prisma.teacherSubjectAssignment.createMany({ data: teacherAssignments, skipDuplicates: true });
  await prisma.assessment.createMany({ data: assessments, skipDuplicates: true });
  await prisma.studentGrade.createMany({ data: studentGrades, skipDuplicates: true });
  await prisma.finalGrade.createMany({ data: finalGrades, skipDuplicates: true });
  // Stamp adviserApprovedAt on the seeded adviser-approved G11–G12 finals so the
  // approval state is complete.
  if (lockedFinalGradeIds.length) {
    await prisma.finalGrade.updateMany({
      where: { id: { in: lockedFinalGradeIds } },
      data: { adviserApprovedAt: new Date() },
    });
  }

  // Attendance (>=20)
  const attendance = [];
  for (let i = 0; i < Math.max(MIN_RECORDS, totalStudents); i++) {
    const st = allStudents[i % totalStudents];
    const section = sections.find((s) => s.id === st.sectionId)!;
    attendance.push({ id: id("att"), studentId: st.userId, sectionId: st.sectionId, date: inTermDate(), session: rand(["AM", "PM"] as Session[]), status: rand(["present", "absent", "late", "excused"] as AttendanceStatus[]), recordedBy: section.adviserId, termId: term.id });
  }
  await prisma.attendanceRecord.createMany({ data: attendance, skipDuplicates: true });

  // Anecdotal + followups (>=20)
  const anecdotals: { id: string; studentId: string; observerId: string; sectionId: string; observationDatetime: Date; descriptionOfIncident: string; descriptionOfLocation: string; notesRecommendationsActions: string; confidentialityLevel: Confidentiality; termId: string }[] = [];
  for (let i = 0; i < Math.max(MIN_RECORDS, totalStudents); i++) {
    const st = allStudents[i % totalStudents];
    const section = sections.find((s) => s.id === st.sectionId)!;
    anecdotals.push({ id: id("anec"), studentId: st.userId, observerId: section.adviserId, sectionId: st.sectionId, observationDatetime: inTermDate(), descriptionOfIncident: rand(INCIDENTS), descriptionOfLocation: "Classroom", notesRecommendationsActions: "Monitor and counsel.", confidentialityLevel: "restricted" as Confidentiality, termId: term.id });
  }
  await prisma.anecdotalRecord.createMany({ data: anecdotals, skipDuplicates: true });
  const anecdotalRecs = await prisma.anecdotalRecord.findMany({ where: { id: { in: anecdotals.map((a) => a.id) } } });
  await prisma.anecdotalRecordFollowup.createMany({ data: anecdotalRecs.map((a) => ({ id: id("af"), anecdotalRecordId: a.id, followupBy: a.observerId, followupDate: inTermDate(), notes: "Followed up with student." })), skipDuplicates: true });

  // Non-adviser subject teacher: files anecdotal records by category.
  const subjTeacherEmail = "teacher.subject@zentra.test";
  const subjTeacher = await prisma.user.upsert({
    where: { email: subjTeacherEmail },
    update: { fullName: "Mr. Subject Teacher", role: "subject_teacher" as Role, passwordHash: staffHash, status: "active" },
    create: { email: subjTeacherEmail, fullName: "Mr. Subject Teacher", role: "subject_teacher" as Role, passwordHash: staffHash, status: "active" },
  });
  await prisma.staffProfile.upsert({
    where: { userId: subjTeacher.id },
    update: { employeeId: "TCH001", isAdviser: false, department: "Academic" },
    create: { userId: subjTeacher.id, employeeId: "TCH001", isAdviser: false, department: "Academic" },
  });
  // Assign the subject teacher to G7-A's Math section (they are NOT the adviser).
  const targetSection = sections.find((s) => s.id === "sec-G7-A")!;
  const targetSubjectId = subjectIds["G7:MATH7"];
  await prisma.teacherSubjectAssignment.upsert({
    where: { teacherId_subjectId_sectionId_termId: { teacherId: subjTeacher.id, subjectId: targetSubjectId, sectionId: targetSection.id, termId: term.id } },
    update: {},
    create: { teacherId: subjTeacher.id, subjectId: targetSubjectId, sectionId: targetSection.id, termId: term.id },
  });
  const subjAnecdotals: { id: string; studentId: string; observerId: string; sectionId: string; observationDatetime: Date; descriptionOfIncident: string; descriptionOfLocation: string; notesRecommendationsActions: string; category: any; confidentialityLevel: Confidentiality; termId: string }[] = [];
  const subjSectionStudents = allStudents.filter((st) => st.sectionId === targetSection.id).slice(0, 5);
  const subjCategories: any[] = ["academic", "behavioral", "attendance", "bullying", "health"];
  subjSectionStudents.forEach((st, idx) => {
    subjAnecdotals.push({
      id: id("anecsubj"),
      studentId: st.userId,
      observerId: subjTeacher.id,
      sectionId: targetSection.id,
      observationDatetime: inTermDate(),
      descriptionOfIncident: rand(INCIDENTS),
      descriptionOfLocation: "Classroom",
      notesRecommendationsActions: "Coordinated with adviser.",
      category: subjCategories[idx % subjCategories.length],
      confidentialityLevel: "restricted" as Confidentiality,
      termId: term.id,
    });
  });
  await prisma.anecdotalRecord.createMany({ data: subjAnecdotals, skipDuplicates: true });

  // Referrals (>=20)
  const referralsData = anecdotalRecs.slice(0, Math.max(MIN_RECORDS, anecdotalRecs.length)).map((a) => ({ id: id("ref"), anecdotalRecordId: a.id, referredToRole: "guidance_counselor" as ReferralTarget, referredBy: a.observerId, reason: "Behavioral concern requiring guidance intervention.", status: rand(["pending", "in_progress", "resolved"] as ReferralStatus[]), studentId: a.studentId, termId: term.id }));
  await prisma.referral.createMany({ data: referralsData, skipDuplicates: true });

  // Interventions (>=20). Seeded to mirror the auto-creation rule: for each
  // at-risk student (first MIN_RECORDS), evaluate the engine risk and create an
  // intervention assigned to the Guidance Counselor. No referralId/reviewedBy
  // (those columns were removed — interventions are engine-driven, not referred).
  for (const st of allStudents.slice(0, Math.max(MIN_RECORDS, totalStudents))) {
    const { result } = await evaluateRisk(st.userId, term.id);
    if (result.riskLevel === "Low") continue;
    await prisma.intervention.create({
      data: {
        id: id("int"),
        studentId: st.userId,
        riskLevelAtFlag: result.riskLevel,
        recommendedAction: "Counseling session and behavior contract.",
        assignedTo: guidance.id,
        assignedAt: inTermDate(),
        approvalStatus: "approved" as ApprovalStatus,
        outcomeStatus: rand(["ongoing", "resolved", "unresolved"] as OutcomeStatus[]),
      },
    });
  }

  // Deterministic at-risk student with NO intervention assigned — lets the
  // Principal exercise the "Create & assign" flow on a clean row. We force a
  // Moderate risk (single anecdote → behavioral flag) and delete any intervention
  // that may have been created for this student above so the drawer shows "None".
  const unassignedAtRisk = allStudents[MIN_RECORDS] ?? allStudents[0];
  if (unassignedAtRisk) {
    const section = await prisma.section.findFirst({ where: { students: { some: { userId: unassignedAtRisk.userId } } }, select: { id: true } });
    await prisma.anecdotalRecord.create({
      data: {
        id: id("an"),
        studentId: unassignedAtRisk.userId,
        observerId: guidance.id,
        sectionId: section?.id ?? unassignedAtRisk.sectionId,
        observationDatetime: inTermDate(),
        descriptionOfIncident: "Seeded behavioral note — unassigned at-risk student.",
        category: "behavioral" as any,
        termId: term.id,
        confidentialityLevel: "restricted" as any,
      },
    });
    await prisma.intervention.deleteMany({ where: { studentId: unassignedAtRisk.userId } });
    await recomputeRisk(unassignedAtRisk.userId, term.id);
  }

  // Health (>=20)
  const health = [];
  for (let i = 0; i < Math.max(MIN_RECORDS, totalStudents); i++) {
    const st = allStudents[i % totalStudents];
    health.push({ id: id("hr"), studentId: st.userId, visitDatetime: inTermDate(), complaint: rand(COMPLAINTS), diagnosis: rand(DIAGNOSES), treatmentGiven: "Administered first aid and advised rest.", recordedBy: nurse.id, termId: term.id, confidentialityLevel: "restricted" as Confidentiality });
  }
  await prisma.healthRecord.createMany({ data: health, skipDuplicates: true });

  // Home visitation (>=20)
  const home = [];
  for (let i = 0; i < Math.max(MIN_RECORDS, totalStudents); i++) {
    const st = allStudents[i % totalStudents];
    home.push({ id: id("hv"), studentId: st.userId, personVisited: rand(["Mother", "Father", "Guardian"]), homeCondition: "Adequate", familyCondition: "Supportive", agreements: "Family agrees to support school interventions.", certificationBy: guidance.id, termId: term.id, confidentialityLevel: "restricted" as Confidentiality });
  }
  await prisma.homeVisitationRecord.createMany({ data: home, skipDuplicates: true });

  // ADM profiles + nested meetings/modules/devices (>=20)
  const admData = [];
  for (let i = 0; i < Math.max(MIN_RECORDS, totalStudents); i++) {
    const st = allStudents[i % totalStudents];
    const ref = referralsData[i % referralsData.length];
    admData.push({ id: id("adm"), studentId: st.userId, referralId: ref.id, eligibilityStatus: rand(["pending", "eligible", "ineligible"] as AdmEligibility[]), preparedBy: admCoord.id, certificationDetails: { needs: "Educational support", plan: "Individualized plan" }, termId: term.id, confidentialityLevel: "restricted" as Confidentiality });
  }
  const FORM_SET: { type: AdmFormType; title: string; status: AdmFormStatus }[] = [
    { type: "REFERRAL_FORM", title: "Referral Form", status: "verified" },
    { type: "ANECDOTAL_REPORT", title: "Anecdotal Report", status: "verified" },
    { type: "MINUTES_OF_MEETING", title: "Minutes of Meeting", status: "submitted" },
    { type: "HV_FORM", title: "HV Form", status: "submitted" },
    { type: "CERTIFICATION", title: "Certification", status: "pending" },
  ];
  for (const a of admData) {
    await prisma.admLearnerProfile.create({
      data: {
        ...a,
        parentMeetings: { create: [{ recordedBy: admCoord.id, meetingDatetime: inTermDate(), attended: true, minutesOfMeeting: "Discussed ADM plan." }] },
        modules: { create: [{ moduleName: "Module 1: Literacy", releaseDate: inTermDate(), dueDate: inTermDate(), submitted: true, submissionDate: inTermDate(), recordedBy: admCoord.id }] },
        devices: { create: [{ deviceType: "Tablet", deviceSerial: `SN${randInt(10000, 99999)}`, issuedBy: admCoord.id, issuedDate: inTermDate() }] },
        forms: {
          create: FORM_SET.map((f) => ({
            formType: f.type,
            title: f.title,
            status: f.status,
            uploadedBy: admCoord.id,
            notes: "Seeded ADM form.",
          })),
        },
      },
    });
  }

  // Risk snapshots (>=20) — computed from real seeded grades/attendance/anecdotals.
  const riskStudents = allStudents.slice(0, Math.max(MIN_RECORDS, totalStudents));
  for (const st of riskStudents) {
    try {
      await recomputeRisk(st.userId, term.id);
    } catch {
      await prisma.riskSnapshot.create({
        data: { id: id("rs"), studentId: st.userId, riskLevel: "Low" as RiskLevel, riskCount: 0, snapshotDate: inTermDate(), termId: term.id },
      });
    }
  }

  // Audit logs (>=20)
  await prisma.auditLog.createMany({ data: Array.from({ length: MIN_RECORDS }, (_, i) => ({ id: id("al"), userId: principal.id, actionType: rand(["account_approval", "grade_lock", "grade_unlock", "referral_status_change", "intervention_approval"] as ActionType[]), sourceTable: "StudentProfile", sourceId: allStudents[i % totalStudents].userId, reason: "Seeded audit entry." })), skipDuplicates: true });

  // Notifications (>=20)
  await prisma.notification.createMany({ data: Array.from({ length: MIN_RECORDS }, (_, i) => ({ id: id("nt"), userId: allStudents[i % totalStudents].userId, type: "attendance_alert", sourceTable: "AttendanceRecord", sourceId: allStudents[i % totalStudents].userId, channel: ["web", "mobile"] as NotifChannel[], message: "Attendance update for your child.", isRead: false })), skipDuplicates: true });

  // Report snapshots (>=20)
  await prisma.reportSnapshot.createMany({ data: sections.slice(0, Math.max(MIN_RECORDS, sections.length)).map((s) => ({ id: id("rp"), reportType: rand(["trends", "intervention_success", "heat_map", "honor_roll"]), scope: "section", scopeId: s.id, termId: term.id, payload: { generated: true, section: s.name } })), skipDuplicates: true });

  console.log(`Seed complete:
  - Staff: ${STAFF_ACCOUNTS.length} + ${sections.length} advisers
  - Sections: ${sections.length}, Students: ${totalStudents}
  - Attendance: ${attendance.length}, Anecdotal: ${anecdotals.length}, Referrals: ${referralsData.length}, Interventions: auto-created for at-risk students (engine rule)
  - Health: ${health.length}, HomeVisitation: ${home.length}, ADM: ${admData.length}, RiskSnapshots: ${Math.min(MIN_RECORDS, totalStudents)}
  - AuditLogs: ${MIN_RECORDS}, Notifications: ${MIN_RECORDS}, ReportSnapshots: ${Math.min(MIN_RECORDS, sections.length)}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

