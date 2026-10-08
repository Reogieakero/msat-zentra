import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import argon2 from "argon2";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const MIN = 50;

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function inTermDate(): Date {
  const start = new Date(2026, 5, 20, 7, 0, 0).getTime();
  const end = Math.min(Date.now(), new Date(2026, 9, 31, 23, 59, 59).getTime());
  return new Date(start + Math.random() * Math.max(0, end - start));
}
function keyId(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 60);
}

const INCIDENTS = [
  "Disruptive behavior during class discussion",
  "Late submission of assignments for three consecutive days",
  "Verbal altercation with a classmate during recess",
  "Incomplete homework without prior notice",
  "Sleeping during morning session",
  "Unauthorized use of mobile phone in class",
];

async function main() {
  const plan: { table: string; have: number; add: number }[] = [];
  const note = async (table: string, have: number, add: number) => {
    plan.push({ table, have, add });
  };

  const term =
    (await prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
    })) ?? (await prisma.term.findFirstOrThrow());
  const terms = await prisma.term.findMany({ select: { id: true } });
  const principal = await prisma.user.findFirstOrThrow({ where: { role: "principal" } });
  const nurse = await prisma.user.findFirstOrThrow({ where: { role: "nurse" } });
  const guidance = await prisma.user.findFirstOrThrow({
    where: { role: "guidance_counselor" },
  });
  const admCoord = await prisma.user.findFirstOrThrow({ where: { role: "adm_coordinator" } });
  const registrarUser = await prisma.user.findFirstOrThrow({ where: { role: "registrar" } });
  const advisers = await prisma.user.findMany({ where: { role: "adviser" } });
  let teachers = await prisma.user.findMany({ where: { role: "subject_teacher" } });
  const sections = await prisma.section.findMany();
  const subjects = await prisma.subject.findMany();
  const components = await prisma.gradeComponent.findMany({ select: { id: true }, take: 50 });
  const roster = await prisma.studentRoster.findMany({
    select: { id: true, lrn: true, fullName: true, sectionId: true, gradeLevel: true },
  });

  const teacherNeed = Math.max(0, 17 - (teachers.length + advisers.length));
  if (!DRY && teacherNeed > 0) {
    const hash = await argon2.hash("Zentra2025!");
    for (let i = 0; i < teacherNeed; i++) {
      const email = `topup50.teacher${i + 1}@zentra.test`;
      const u = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          id: keyId("topup50_tch", email),
          email,
          fullName: `Topup Teacher ${i + 1}`,
          role: "subject_teacher",
          passwordHash: hash,
          status: "active",
        },
      });
      await prisma.staffProfile.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, employeeId: `TOP${i + 1}`, isAdviser: false },
      });
    }
    teachers = await prisma.user.findMany({ where: { role: "subject_teacher" } });
  }
  await note("User(teacher topup)", teachers.length, DRY ? teacherNeed : 0);

  const profiles = await prisma.studentProfile.findMany({ select: { userId: true, lrn: true } });
  const profileLrns = new Set(profiles.map((p) => p.lrn));
  const unregistered = roster.filter((r) => !profileLrns.has(r.lrn));
  const profileNeed = Math.max(0, MIN - profiles.length);
  const toRegister = unregistered.slice(0, profileNeed);
  if (!DRY && toRegister.length > 0) {
    const hash = await argon2.hash("Student2025!");
    for (const r of toRegister) {
      const email = `topup50.${r.lrn.toLowerCase()}@zentra.test`;
      const u = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          id: keyId("topup50_stu", r.lrn),
          email,
          fullName: r.fullName,
          role: "student",
          passwordHash: hash,
          status: "active",
          lrn: r.lrn,
        },
      });
      await prisma.studentProfile.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, lrn: r.lrn, gradeLevel: r.gradeLevel, sectionId: r.sectionId },
      });
    }
  }
  await note("StudentProfile", profiles.length, toRegister.length);
  const allProfiles = await prisma.studentProfile.findMany({
    select: { userId: true, lrn: true, sectionId: true, gradeLevel: true },
  });

  const pickProfile = (i: number) => allProfiles[i % allProfiles.length];
  const pickRoster = (i: number) => roster[i % roster.length];
  const sectionOf = (sectionId: string | null) =>
    sections.find((s) => s.id === sectionId) ?? sections[i0() % sections.length];
  let seq = 0;
  const i0 = () => seq++;

  {
    const have = await prisma.anecdotalRecord.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && advisers.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const r = pickRoster(have + k);
        const sec = sections.find((s) => s.id === r.sectionId) ?? sections[0];
        return {
          id: keyId("topup50_ar", `${r.id}_${k}`),
          rosterId: r.id,
          observerId: advisers[(have + k) % advisers.length].id,
          sectionId: sec.id,
          observationDatetime: inTermDate(),
          descriptionOfIncident: INCIDENTS[(have + k) % INCIDENTS.length],
          descriptionOfLocation: "Classroom",
          notesRecommendationsActions: "Monitor and follow up with parents.",
          termId: term.id,
          category: "behavioral" as const,
          confidentialityLevel: "restricted" as const,
        };
      });
      await prisma.anecdotalRecord.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AnecdotalRecord", have, need);
  }
  const anecdotals = await prisma.anecdotalRecord.findMany({
    select: { id: true, observerId: true, studentId: true, rosterId: true },
  });

  {
    const have = await prisma.anecdotalFolder.count();
    const need = Math.max(0, MIN - have);
    const owners = [...advisers, ...teachers];
    if (!DRY && need > 0 && owners.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_af", `${owners[(have + k) % owners.length].id}_${k}`),
        ownerId: owners[(have + k) % owners.length].id,
        name: `Top-up folder ${(have + k) % 10 + 1}`,
      }));
      await prisma.anecdotalFolder.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AnecdotalFolder", have, need);
  }

  {
    const have = await prisma.anecdotalRecordFollowup.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && anecdotals.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const a = anecdotals[(have + k) % anecdotals.length];
        return {
          id: keyId("topup50_afu", `${a.id}_${k}`),
          anecdotalRecordId: a.id,
          followupBy: advisers.length > 0 ? advisers[(have + k) % advisers.length].id : a.observerId,
          followupDate: inTermDate(),
          notes: "Followed up with student and parents.",
        };
      });
      await prisma.anecdotalRecordFollowup.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AnecdotalRecordFollowup", have, need);
  }

  {
    const have = await prisma.referral.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && anecdotals.length > 0) {
      const targets = ["guidance_counselor", "nurse", "adm_coordinator"] as const;
      const rows = Array.from({ length: need }, (_, k) => {
        const a = anecdotals[(have + k) % anecdotals.length];
        return {
          id: keyId("topup50_ref", `${a.id}_${k}`),
          anecdotalRecordId: a.id,
          referredToRole: targets[(have + k) % targets.length],
          referredBy: a.observerId,
          reason: "Behavioral concern requiring specialist review.",
          status: ["pending", "in_progress", "resolved"][(have + k) % 3] as
            | "pending"
            | "in_progress"
            | "resolved",
          studentId: a.studentId,
          rosterId: a.rosterId,
          termId: term.id,
        };
      });
      await prisma.referral.createMany({ data: rows, skipDuplicates: true });
    }
    await note("Referral", have, need);
  }
  const referrals = await prisma.referral.findMany({ select: { id: true } });

  {
    const have = await prisma.admLearnerProfile.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && referrals.length > 0 && allProfiles.length > 0) {
      for (let k = 0; k < need; k++) {
        const st = pickProfile(have + k);
        const ref = referrals[(have + k) % referrals.length];
        const pid = keyId("topup50_adm", `${st.userId}_${have + k}`);
        await prisma.admLearnerProfile.upsert({
          where: { id: pid },
          update: {},
          create: {
            id: pid,
            studentId: st.userId,
            referralId: ref.id,
            eligibilityStatus: ["pending", "eligible", "ineligible"][(have + k) % 3] as
              | "pending"
              | "eligible"
              | "ineligible",
            preparedBy: admCoord.id,
            certificationDetails: { needs: "Educational support", plan: "Top-up plan" },
            termId: term.id,
            confidentialityLevel: "restricted",
            parentMeetings: {
              create: [
                {
                  recordedBy: admCoord.id,
                  meetingDatetime: inTermDate(),
                  attended: (have + k) % 2 === 0,
                  minutesOfMeeting: "Discussed ADM plan.",
                },
              ],
            },
            modules: {
              create: [
                {
                  moduleName: `Top-up Module ${(have + k) % 5 + 1}`,
                  releaseDate: inTermDate(),
                  dueDate: inTermDate(),
                  submitted: (have + k) % 2 === 0,
                  recordedBy: admCoord.id,
                },
              ],
            },
            devices: {
              create: [
                {
                  deviceType: "Tablet",
                  deviceSerial: `TOPUP${have + k}${randInt(100, 999)}`,
                  issuedBy: admCoord.id,
                  issuedDate: inTermDate(),
                },
              ],
            },
            forms: {
              create: [
                {
                  formType: "REFERRAL_FORM",
                  title: "Referral Form",
                  status: "verified",
                  uploadedBy: admCoord.id,
                  notes: "Top-up ADM form.",
                },
              ],
            },
          },
        });
      }
    }
    await note("AdmLearnerProfile(+nested)", have, need);
  }
  const profiles50 = await prisma.admLearnerProfile.findMany({ select: { id: true } });
  const meetings = await prisma.admParentMeeting.findMany({ select: { id: true } });

  {
    const have = meetings.length;
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && referrals.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_apm", `${referrals[(have + k) % referrals.length].id}_${k}`),
        referralId: referrals[(have + k) % referrals.length].id,
        recordedBy: admCoord.id,
        meetingDatetime: inTermDate(),
        attended: (have + k) % 2 === 0,
        minutesOfMeeting: "Top-up parent meeting.",
      }));
      await prisma.admParentMeeting.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AdmParentMeeting", have, need);
  }
  const meetings50 = await prisma.admParentMeeting.findMany({ select: { id: true } });

  {
    const have = await prisma.admMeetingInvitee.count();
    const need = Math.max(0, MIN - have);
    const staffPool = [guidance, nurse, admCoord, ...advisers.slice(0, 3)];
    if (!DRY && need > 0 && meetings50.length > 0) {
      const rows = [];
      let k = 0;
      while (rows.length < need && k < need * 5) {
        rows.push({
          id: keyId("topup50_ami", `${meetings50[(have + k) % meetings50.length].id}_${staffPool[k % staffPool.length].id}_${k}`),
          meetingId: meetings50[(have + k) % meetings50.length].id,
          userId: staffPool[k % staffPool.length].id,
        });
        k++;
      }
      await prisma.admMeetingInvitee.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AdmMeetingInvitee", have, need);
  }

  {
    const have = await prisma.admMeetingAttachment.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && meetings50.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_ama", `${meetings50[(have + k) % meetings50.length].id}_${k}`),
        meetingId: meetings50[(have + k) % meetings50.length].id,
        fileUrl: `https://example.com/topup/meeting-${have + k}.jpg`,
        fileName: `meeting-${have + k}.jpg`,
        mimeType: "image/jpeg",
        fileSize: 1024 * (10 + ((have + k) % 90)),
        uploadedBy: admCoord.id,
      }));
      await prisma.admMeetingAttachment.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AdmMeetingAttachment", have, need);
  }

  {
    const mHave = await prisma.admModule.count();
    const mNeed = Math.max(0, MIN - mHave);
    const dHave = await prisma.admDevice.count();
    const dNeed = Math.max(0, MIN - dHave);
    const fHave = await prisma.admForm.count();
    const fNeed = Math.max(0, MIN - fHave);
    if (!DRY && profiles50.length > 0) {
      if (mNeed > 0) {
        const rows = Array.from({ length: mNeed }, (_, k) => ({
          id: keyId("topup50_mod", `${profiles50[(mHave + k) % profiles50.length].id}_${k}`),
          admLearnerProfileId: profiles50[(mHave + k) % profiles50.length].id,
          moduleName: `Top-up Module ${(mHave + k) % 8 + 1}`,
          releaseDate: inTermDate(),
          dueDate: inTermDate(),
          submitted: (mHave + k) % 2 === 0,
          recordedBy: admCoord.id,
        }));
        await prisma.admModule.createMany({ data: rows, skipDuplicates: true });
      }
      if (dNeed > 0) {
        const rows = Array.from({ length: dNeed }, (_, k) => ({
          id: keyId("topup50_dev", `${profiles50[(dHave + k) % profiles50.length].id}_${k}`),
          admLearnerProfileId: profiles50[(dHave + k) % profiles50.length].id,
          deviceType: "Tablet",
          deviceSerial: `TOPUPD${dHave + k}${randInt(100, 999)}`,
          issuedBy: admCoord.id,
          issuedDate: inTermDate(),
        }));
        await prisma.admDevice.createMany({ data: rows, skipDuplicates: true });
      }
      if (fNeed > 0) {
        const types = ["REFERRAL_FORM", "ANECDOTAL_REPORT", "MINUTES_OF_MEETING", "HV_FORM", "CERTIFICATION"] as const;
        const rows = Array.from({ length: fNeed }, (_, k) => ({
          id: keyId("topup50_frm", `${profiles50[(fHave + k) % profiles50.length].id}_${k}`),
          admLearnerProfileId: profiles50[(fHave + k) % profiles50.length].id,
          formType: types[(fHave + k) % types.length],
          title: "Top-up form",
          status: "submitted" as const,
          uploadedBy: admCoord.id,
          notes: "Top-up ADM form.",
        }));
        await prisma.admForm.createMany({ data: rows, skipDuplicates: true });
      }
    }
    await note("AdmModule", mHave, mNeed);
    await note("AdmDevice", dHave, dNeed);
    await note("AdmForm", fHave, fNeed);
  }

  {
    const hHave = await prisma.healthRecord.count();
    const hNeed = Math.max(0, MIN - hHave);
    const vHave = await prisma.homeVisitationRecord.count();
    const vNeed = Math.max(0, MIN - vHave);
    if (!DRY && allProfiles.length > 0) {
      if (hNeed > 0) {
        const rows = Array.from({ length: hNeed }, (_, k) => {
          const st = pickProfile(hHave + k);
          return {
            id: keyId("topup50_hr", `${st.userId}_${k}`),
            studentId: st.userId,
            visitDatetime: inTermDate(),
            complaint: "Mild fever and headache",
            diagnosis: "Viral fever, advised rest and hydration",
            treatmentGiven: "Administered first aid and advised rest.",
            recordedBy: nurse.id,
            termId: term.id,
            confidentialityLevel: "restricted" as const,
          };
        });
        await prisma.healthRecord.createMany({ data: rows, skipDuplicates: true });
      }
      if (vNeed > 0) {
        const rows = Array.from({ length: vNeed }, (_, k) => {
          const st = pickProfile(vHave + k);
          return {
            id: keyId("topup50_hv", `${st.userId}_${k}`),
            studentId: st.userId,
            personVisited: ["Mother", "Father", "Guardian"][(vHave + k) % 3],
            homeCondition: "Adequate",
            familyCondition: "Supportive",
            agreements: "Family agrees to support school interventions.",
            certificationBy: guidance.id,
            termId: term.id,
            confidentialityLevel: "restricted" as const,
          };
        });
        await prisma.homeVisitationRecord.createMany({ data: rows, skipDuplicates: true });
      }
    }
    await note("HealthRecord", hHave, hNeed);
    await note("HomeVisitationRecord", vHave, vNeed);
  }

  {
    const have = await prisma.counselingSession.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && referrals.length > 0) {
      const types = ["individual", "parent_conference", "group", "home_visit"];
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_cs", `${referrals[(have + k) % referrals.length].id}_${k}`),
        referralId: referrals[(have + k) % referrals.length].id,
        sessionType: types[(have + k) % types.length],
        scheduledAt: inTermDate(),
        venue: "Guidance office",
        status: ["scheduled", "completed", "cancelled"][(have + k) % 3],
        sessionNotes: (have + k) % 3 === 1 ? "Session completed with action items." : null,
        createdBy: guidance.id,
      }));
      await prisma.counselingSession.createMany({ data: rows, skipDuplicates: true });
    }
    await note("CounselingSession", have, need);
  }
  const sessions = await prisma.counselingSession.findMany({ select: { id: true } });

  {
    const have = await prisma.clinicSessionAttachment.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && sessions.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_csa", `${sessions[(have + k) % sessions.length].id}_${k}`),
        sessionId: sessions[(have + k) % sessions.length].id,
        fileUrl: `https://example.com/topup/session-${have + k}.jpg`,
        fileName: `session-${have + k}.jpg`,
        mimeType: "image/jpeg",
        fileSize: 1024 * (20 + ((have + k) % 80)),
        uploadedBy: nurse.id,
      }));
      await prisma.clinicSessionAttachment.createMany({ data: rows, skipDuplicates: true });
    }
    await note("ClinicSessionAttachment", have, need);
  }

  {
    const have = await prisma.assessment.count();
    const need = Math.max(0, MIN - have);
    const creators = [...teachers, ...advisers];
    if (!DRY && need > 0 && components.length > 0 && creators.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_asm", `${components[(have + k) % components.length].id}_${k}`),
        gradeComponentId: components[(have + k) % components.length].id,
        title: `Top-up Quiz ${have + k + 1}`,
        maxScore: 50,
        dateGiven: inTermDate(),
        createdBy: creators[(have + k) % creators.length].id,
      }));
      await prisma.assessment.createMany({ data: rows, skipDuplicates: true });
    }
    await note("Assessment", have, need);
  }
  const assessments = await prisma.assessment.findMany({ select: { id: true, maxScore: true } });

  {
    const have = await prisma.studentGrade.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && assessments.length > 0 && roster.length > 0) {
      const existingPairs = new Set(
        (await prisma.studentGrade.findMany({ select: { assessmentId: true, rosterId: true } })).map(
          (e) => `${e.assessmentId}::${e.rosterId}`,
        ),
      );
      const rows = [];
      let k = 0;
      let guard = 0;
      while (rows.length < need && guard < need * 100) {
        const a = assessments[(have + k) % assessments.length];
        const r = pickRoster(have * 7 + k * 13);
        if (!existingPairs.has(`${a.id}::${r.id}`)) {
          existingPairs.add(`${a.id}::${r.id}`);
          rows.push({
            id: `topup50_sg2_${have}_${k}`,
            assessmentId: a.id,
            rosterId: r.id,
            rawScore: Math.min(a.maxScore, Math.round(a.maxScore * (0.5 + Math.random() * 0.5))),
            percentageScore: Math.round((50 + Math.random() * 50) * 10) / 10,
          });
        }
        k++;
        guard++;
      }
      await prisma.studentGrade.createMany({ data: rows, skipDuplicates: true });
    }
    await note("StudentGrade", have, need);
  }

  {
    const have = await prisma.finalGrade.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && subjects.length > 0 && roster.length > 0) {
      const rows = [];
      let k = 0;
      while (rows.length < need && k < need * 10) {
        const s = subjects[(have + k) % subjects.length];
        const r = pickRoster(have + k);
        const avg = Math.round((70 + Math.random() * 28) * 10) / 10;
        rows.push({
          id: keyId("topup50_fg", `${r.id}_${s.id}_${k}`),
          rosterId: r.id,
          subjectId: s.id,
          termId: term.id,
          computedAverage: avg,
          transmutedGrade: Math.round(avg),
          remarks: (avg >= 75 ? "Passed" : "Failed") as "Passed" | "Failed",
        });
        k++;
      }
      await prisma.finalGrade.createMany({ data: rows, skipDuplicates: true });
    }
    await note("FinalGrade", have, need);
  }

  {
    const have = await prisma.gradeFlag.count();
    const need = Math.max(0, MIN - have);
    const reasons = ["wrong_score", "missing_assessment", "transmutation_error", "late_submission", "other"] as const;
    if (!DRY && need > 0 && allProfiles.length > 0 && subjects.length > 0 && sections.length > 0 && teachers.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const st = pickProfile(have + k);
        const sec = sectionOf(st.sectionId);
        return {
          id: keyId("topup50_gf", `${st.userId}_${k}`),
          studentId: st.userId,
          subjectId: subjects[(have + k) % subjects.length].id,
          sectionId: sec.id,
          termId: term.id,
          reason: reasons[(have + k) % reasons.length],
          note: "Top-up grade flag for review.",
          status: (have + k) % 4 === 3 ? ("resolved" as const) : ("open" as const),
          raisedBy: teachers[(have + k) % teachers.length].id,
        };
      });
      await prisma.gradeFlag.createMany({ data: rows, skipDuplicates: true });
    }
    await note("GradeFlag", have, need);
  }

  {
    const have = await prisma.sf10Record.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && allProfiles.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const st = pickProfile(have + k);
        return {
          id: keyId("topup50_sf10", `${st.userId}_${k}`),
          studentId: st.userId,
          source: "manual" as const,
        };
      });
      const existing = await prisma.sf10Record.findMany({ select: { studentId: true } });
      const taken = new Set(existing.map((e) => e.studentId));
      const fresh = rows.filter((r) => !taken.has(r.studentId));
      await prisma.sf10Record.createMany({ data: fresh.slice(0, need), skipDuplicates: true });
    }
    await note("Sf10Record", have, need);
  }
  const sf10s = await prisma.sf10Record.findMany({ select: { id: true } });
  {
    const have = await prisma.sf10RecordVersion.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && sf10s.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_sfv", `${sf10s[(have + k) % sf10s.length].id}_${k}`),
        sf10RecordId: sf10s[(have + k) % sf10s.length].id,
        versionNumber: 1 + ((have + k) % 3),
        dataSnapshot: { topup: true, seq: have + k },
        changedBy: registrarUser.id,
        changeReason: "Top-up version history.",
      }));
      await prisma.sf10RecordVersion.createMany({ data: rows, skipDuplicates: true });
    }
    await note("Sf10RecordVersion", have, need);
  }

  {
    const have = await prisma.adviserSf10AccessRequest.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && advisers.length > 0 && sections.length > 0) {
      const statuses = ["pending", "approved", "denied"] as const;
      const rows = Array.from({ length: need }, (_, k) => {
        const sec = sections[(have + k) % sections.length];
        const st = statuses[(have + k) % statuses.length];
        return {
          id: keyId("topup50_asr", `${sec.id}_${k}`),
          adviserId: advisers[(have + k) % advisers.length].id,
          sectionId: sec.id,
          gradeLevel: sec.gradeLevel,
          reason: "Top-up access request for SF10 review.",
          status: st,
          decidedBy: st === "pending" ? null : registrarUser.id,
          decidedAt: st === "pending" ? null : inTermDate(),
        };
      });
      await prisma.adviserSf10AccessRequest.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AdviserSf10AccessRequest", have, need);
  }

  {
    const have = await prisma.adviserArchivedStudent.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && advisers.length > 0 && roster.length > 0) {
      const rows = [];
      let k = 0;
      while (rows.length < need && k < need * 10) {
        const t = advisers[(have + k) % advisers.length];
        const r = pickRoster(have + k);
        rows.push({
          id: keyId("topup50_aas", `${t.id}_${r.id}_${k}`),
          teacherId: t.id,
          rosterId: r.id,
        });
        k++;
      }
      await prisma.adviserArchivedStudent.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AdviserArchivedStudent", have, need);
  }

  {
    const have = await prisma.teacherTermGrant.count();
    const need = Math.max(0, MIN - have);
    const grantPool = [...teachers, ...advisers];
    if (!DRY && need > 0 && grantPool.length > 0 && terms.length > 0) {
      const existingPairs = new Set(
        (await prisma.teacherTermGrant.findMany({ select: { userId: true, termId: true } })).map(
          (e) => `${e.userId}::${e.termId}`,
        ),
      );
      const rows = [];
      let ti = 0;
      while (rows.length < need && ti < grantPool.length * terms.length) {
        const t = grantPool[ti % grantPool.length];
        const tm = terms[Math.floor(ti / grantPool.length) % terms.length];
        if (!existingPairs.has(`${t.id}::${tm.id}`)) {
          existingPairs.add(`${t.id}::${tm.id}`);
          rows.push({
            id: keyId("topup50_ttg", `${t.id}_${tm.id}`),
            userId: t.id,
            termId: tm.id,
            via: ti % 2 === 0 ? "adviser" : "code",
          });
        }
        ti++;
      }
      await prisma.teacherTermGrant.createMany({ data: rows.slice(0, need), skipDuplicates: true });
    }
    await note("TeacherTermGrant", have, need);
  }

  {
    const have = await prisma.teacherName.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0) {
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_tn", `name_${have + k}`),
        name: `Topup Catalog Teacher ${have + k + 1}`,
        code: `TOP-${have + k + 1}`,
      }));
      await prisma.teacherName.createMany({ data: rows, skipDuplicates: true });
    }
    await note("TeacherName", have, need);
  }

  {
    const have = await prisma.reportSnapshot.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0) {
      const types = ["trends", "intervention_success", "heat_map", "honor_roll"];
      const rows = Array.from({ length: need }, (_, k) => ({
        id: keyId("topup50_rp", `snap_${have + k}`),
        reportType: types[(have + k) % types.length],
        scope: ["school", "grade", "section"][(have + k) % 3],
        scopeId: (have + k) % 3 === 2 && sections.length > 0 ? sections[(have + k) % sections.length].id : null,
        termId: term.id,
        payload: { topup: true, seq: have + k },
      }));
      await prisma.reportSnapshot.createMany({ data: rows, skipDuplicates: true });
    }
    await note("ReportSnapshot", have, need);
  }

  {
    const have = await prisma.attendanceRecordLegacy.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && roster.length > 0 && sections.length > 0 && advisers.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const r = pickRoster(have + k);
        const sec = sections.find((s) => s.id === r.sectionId) ?? sections[0];
        return {
          id: keyId("topup50_al", `${r.id}_${k}`),
          rosterId: r.id,
          sectionId: sec.id,
          date: inTermDate(),
          session: (have + k) % 2 === 0 ? ("AM" as const) : ("PM" as const),
          status: ["present", "absent", "late", "excused"][(have + k) % 4] as
            | "present"
            | "absent"
            | "late"
            | "excused",
          recordedBy: advisers[(have + k) % advisers.length].id,
          termId: term.id,
        };
      });
      await prisma.attendanceRecordLegacy.createMany({ data: rows, skipDuplicates: true });
    }
    await note("AttendanceRecordLegacy", have, need);
  }

  {
    const have = await prisma.scheduleConfig.count();
    if (!DRY) {
      for (const t of terms) {
        await prisma.scheduleConfig.upsert({
          where: { termId: t.id },
          update: {},
          create: { termId: t.id },
        });
      }
    }
    const after = DRY ? have : await prisma.scheduleConfig.count();
    await note("ScheduleConfig(capped@terms)", have, after - have);
  }

  {
    const have = await prisma.intervention.count();
    const need = Math.max(0, MIN - have);
    if (!DRY && need > 0 && roster.length > 0) {
      const rows = Array.from({ length: need }, (_, k) => {
        const r = pickRoster(have + k);
        return {
          id: keyId("topup50_iv", `${r.id}_${k}`),
          rosterId: r.id,
          riskLevelAtFlag: "Moderate" as const,
          recommendedAction: "Top-up monitoring and guidance follow-up.",
          termId: term.id,
        };
      });
      await prisma.intervention.createMany({ data: rows, skipDuplicates: true });
    }
    await note("Intervention", have, need);
  }

  console.log(DRY ? "DRY-RUN plan (no writes):" : "Top-up result (have -> +add):");
  console.log("table,have,add");
  for (const p of plan) console.log(`${p.table},${p.have},${p.add}`);
  console.log("NOTE: ScheduleConfig capped by schema (termId @unique, 3 terms -> max 3 rows).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
