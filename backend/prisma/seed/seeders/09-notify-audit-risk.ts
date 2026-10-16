import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { DRY, SIZE } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { GradebookCtx } from "./03-gradebook.js";
import type { AttendanceCtx } from "./04-attendance.js";
import type { BehavioralCtx } from "./05-behavioral.js";
import type { Rng } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { bulkCreate, Batcher } from "../utils/chunk.js";

function flagsFor(avg: number[] | undefined, present: number, total: number, anec: number) {
  const academic = avg && avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length < 75 : false;
  const attendance = total > 0 ? present / total < 0.8 : false;
  const behavioral = anec >= 1;
  const count = (academic ? 1 : 0) + (attendance ? 1 : 0) + (behavioral ? 1 : 0);
  const level = count >= 2 ? "High" : count === 1 ? "Moderate" : "Low";
  return { academic, attendance, behavioral, count, level };
}

export async function seedNotifyAuditRisk(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  grades: GradebookCtx,
  attend: AttendanceCtx,
  behav: BehavioralCtx,
  rng: Rng,
) {
  if (DRY) return;
  const t1 = core.termIds.find((t) => t.n === 1)!;
  const t2 = core.termIds.find((t) => t.n === 2)!;
  const guidanceId = core.staff["guidance"] ?? core.principalId;
  const registrarId = core.staff["registrar"] ?? core.principalId;

  // ---- Risk snapshots + profile updates + interventions ----
  {
    const snapshotRows: any[] = [];
    const interventionRows: any[] = [];
    const terms = [core.t1Id, core.t2Id];
    for (const termId of terms) {
      const avgMap = grades.avgTransmuted.get(termId) ?? new Map();
      // Roster
      for (const r of roster.rosterAll) {
        const key = `R:${r.id}`;
        const avg = avgMap.get(key);
        const pc = attend.presentCount.get(`${termId}|${key}`) ?? { present: 0, total: 0 };
        const anec = behav.anecdotalCount.get(`${termId}|${key}`) ?? 0;
        const f = flagsFor(avg, pc.present, pc.total, anec);
        snapshotRows.push({
          rosterId: r.id,
          riskLevel: f.level as any,
          riskLevelRaw: f.level as any,
          riskLevelFinal: f.level as any,
          academicFlag: f.academic,
          attendanceFlag: f.attendance,
          behavioralFlag: f.behavioral,
          academicFlagRaw: f.academic,
          attendanceFlagRaw: f.attendance,
          behavioralFlagRaw: f.behavioral,
          riskCount: f.count,
          snapshotDate: termId === core.t1Id ? new Date("2026-09-15T00:00:00Z") : new Date(),
          termId,
        });
        if (f.level !== "Low") {
          interventionRows.push({
            rosterId: r.id,
            riskLevelAtFlag: f.level as any,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidanceId,
            assignedAt: new Date(),
            approvalStatus: "approved" as const,
            outcomeStatus: rng.weighted(["ongoing", "resolved", "unresolved"], [0.7, 0.2, 0.1]) as any,
            termId,
          });
        }
      }
      // Profiles
      for (const p of roster.profiles) {
        const key = `S:${p.userId}`;
        const avg = avgMap.get(key);
        const pc = attend.presentCount.get(`${termId}|${key}`) ?? { present: 0, total: 0 };
        const anec = behav.anecdotalCount.get(`${termId}|${key}`) ?? 0;
        const f = flagsFor(avg, pc.present, pc.total, anec);
        snapshotRows.push({
          studentId: p.userId,
          riskLevel: f.level as any,
          riskLevelRaw: f.level as any,
          riskLevelFinal: f.level as any,
          academicFlag: f.academic,
          attendanceFlag: f.attendance,
          behavioralFlag: f.behavioral,
          academicFlagRaw: f.academic,
          attendanceFlagRaw: f.attendance,
          behavioralFlagRaw: f.behavioral,
          riskCount: f.count,
          snapshotDate: termId === core.t1Id ? new Date("2026-09-15T00:00:00Z") : new Date(),
          termId,
        });
        if (f.level !== "Low") {
          interventionRows.push({
            studentId: p.userId,
            riskLevelAtFlag: f.level as any,
            recommendedAction: "Auto-flagged at-risk student — assigned to Guidance Counselor for follow-up.",
            assignedTo: guidanceId,
            assignedAt: new Date(),
            approvalStatus: "approved" as const,
            outcomeStatus: rng.weighted(["ongoing", "resolved", "unresolved"], [0.7, 0.2, 0.1]) as any,
            termId,
          });
        }
      }
    }
    await bulkCreate("RiskSnapshots", snapshotRows.length, (ch) => prisma.riskSnapshot.createMany({ data: ch }) as any, snapshotRows, 2000);
    await bulkCreate("Interventions(auto)", interventionRows.length, (ch) => prisma.intervention.createMany({ data: ch }) as any, interventionRows, 2000);

    // Update profile/roster risk fields in groups by level (fast, 6 updates per term).
    for (const termId of terms) {
      void termId;
    }
    // Per-student flag updates (chunked, ~3900 rows). Use raw SQL for speed.
    // Build CASE updates per 500.
    const allUpdates: { table: string; idCol: string; id: string; count: number; level: string; af: boolean; atf: boolean; bf: boolean }[] = [];
    // Recompute quickly from snapshotRows (already have flags).
    for (const s of snapshotRows) {
      if (s.studentId) allUpdates.push({ table: '"StudentProfile"', idCol: '"userId"', id: s.studentId, count: s.riskCount, level: s.riskLevel, af: s.academicFlag, atf: s.attendanceFlag, bf: s.behavioralFlag });
      else allUpdates.push({ table: '"StudentRoster"', idCol: '"id"', id: s.rosterId, count: s.riskCount, level: s.riskLevel, af: s.academicFlag, atf: s.attendanceFlag, bf: s.behavioralFlag });
    }
    // Last-write wins per student across T1/T2 (use T2 state as current).
    const latest = new Map<string, (typeof allUpdates)[number]>();
    for (const u of allUpdates) latest.set(`${u.table}|${u.id}`, u);
    const latestArr = [...latest.values()];
    for (let i = 0; i < latestArr.length; i += 500) {
      const ch = latestArr.slice(i, i + 500);
      await Promise.all(
        ch.map((u) =>
          prisma
            .$executeRawUnsafe(
              `UPDATE ${u.table} SET "riskCount"=$1, "riskLevel"=$2::"RiskLevel", "academicFlag"=$3, "attendanceFlag"=$4, "behavioralFlag"=$5 WHERE ${u.idCol}=$6;`,
              u.count,
              u.level,
              u.af,
              u.atf,
              u.bf,
              u.id,
            )
            .catch(() => {}),
        ),
      );
    }
    console.log(`  RiskProfilesUpdated: ${latestArr.length}`);
  }

  // ---- Report snapshots ----
  {
    const rows: any[] = [];
    for (const termId of [core.t1Id, core.t2Id]) {
      for (const sec of acad.sections) {
        rows.push({ reportType: "trends", scope: "section", scopeId: sec.id, termId, payload: { section: sec.name, attendanceRate: 0.9, generated: true }, generatedAt: termId === core.t1Id ? new Date("2026-09-16T00:00:00Z") : new Date() });
        if (rng.next() < 0.5) {
          rows.push({ reportType: "heat_map", scope: "section", scopeId: sec.id, termId, payload: { section: sec.name, atRisk: rng.int(2, 10) }, generatedAt: new Date() });
        }
      }
      rows.push({ reportType: "honor_roll", scope: "school", scopeId: null, termId, payload: { term: termId, qualifiers: rng.int(20, 60) }, generatedAt: new Date() });
      rows.push({ reportType: "intervention_success", scope: "school", scopeId: null, termId, payload: { resolved: rng.int(10, 40), ongoing: rng.int(20, 80) }, generatedAt: new Date() });
    }
    await bulkCreate("ReportSnapshots", rows.length, (ch) => prisma.reportSnapshot.createMany({ data: ch }) as any, rows, 1000);
  }

  // ---- Notifications (~12-15k, action-derived) ----
  {
    const batcher = new Batcher("Notifications", 2000, (ch) => prisma.notification.createMany({ data: ch }) as any);
    // Grade posted to students+parents (30% of locked/approved finals).
    const finals = await prisma.finalGrade.findMany({
      where: { termId: { in: [core.t1Id, core.t2Id] }, lockStatus: { in: ["locked", "adviser_approved"] }, studentId: { not: null } },
      select: { studentId: true, subjectId: true, termId: true },
      take: SIZE === "full" ? 20000 : 3000,
    });
    for (const f of finals) {
      if (rng.next() > 0.35) continue;
      const term = f.termId === core.t1Id ? t1 : t2;
      if (f.studentId) {
        await batcher.push({
          userId: f.studentId,
          type: "grade_posted",
          sourceTable: "FinalGrade",
          sourceId: f.subjectId,
          channel: ["web"] as any,
          message: "Your grades have been updated. Please review your report.",
          isRead: rng.next() < 0.6,
          createdAt: inTermDate(rng, term.start, term.end),
        });
        const parentId = roster.parentByStudent.get(f.studentId);
        if (parentId && rng.next() < 0.8) {
          await batcher.push({
            userId: parentId,
            type: "grade_posted",
            sourceTable: "FinalGrade",
            sourceId: f.subjectId,
            channel: ["web", "mobile"] as any,
            message: "Grade update for your child is available.",
            isRead: rng.next() < 0.55,
            createdAt: inTermDate(rng, term.start, term.end),
          });
        }
      }
    }
    // Referral -> target role user.
    const roleUser: Record<string, string> = {
      guidance_counselor: core.staff["guidance"] ?? guidanceId,
      nurse: core.staff["nurse"] ?? guidanceId,
      adm_coordinator: core.staff["adm"] ?? guidanceId,
      principal: core.principalId,
    };
    for (const r of behav.referrals) {
      const uid = roleUser[r.role] ?? guidanceId;
      await batcher.push({
        userId: uid,
        type: "referral_update",
        sourceTable: "Referral",
        sourceId: r.id,
        channel: ["web"] as any,
        message: `New ${r.role} referral requires review.`,
        isRead: rng.next() < 0.5,
        createdAt: inTermDate(rng, t1.start, t2.end),
      });
    }
    // ADM -> coordinator + principal.
    const admProfiles = await prisma.admLearnerProfile.findMany({ select: { id: true, termId: true } });
    for (const a of admProfiles) {
      const term = a.termId === core.t1Id ? t1 : t2;
      await batcher.push({
        userId: core.staff["adm"] ?? guidanceId,
        type: "adm_update",
        sourceTable: "AdmLearnerProfile",
        sourceId: a.id,
        channel: ["web"] as any,
        message: "ADM case updated and needs monitoring.",
        isRead: rng.next() < 0.5,
        createdAt: inTermDate(rng, term.start, term.end),
      });
      if (rng.next() < 0.5) {
        await batcher.push({
          userId: core.principalId,
          type: "adm_approval",
          sourceTable: "AdmLearnerProfile",
          sourceId: a.id,
          channel: ["web"] as any,
          message: "ADM certification awaiting principal approval.",
          isRead: rng.next() < 0.6,
          createdAt: inTermDate(rng, term.start, term.end),
        });
      }
    }
    // Interventions -> guidance + adviser.
    const interventions = await prisma.intervention.findMany({ select: { id: true, termId: true, studentId: true, rosterId: true }, take: SIZE === "full" ? 3000 : 500 });
    for (const iv of interventions) {
      const term = iv.termId === core.t1Id ? t1 : t2;
      await batcher.push({
        userId: guidanceId,
        type: "intervention_assigned",
        sourceTable: "Intervention",
        sourceId: iv.id,
        channel: ["web"] as any,
        message: "At-risk student flagged for follow-up.",
        isRead: rng.next() < 0.5,
        createdAt: inTermDate(rng, term.start, term.end),
      });
    }
    // Grade flags -> owner.
    const flags = await prisma.gradeFlag.findMany({ select: { id: true, ownerId: true, termId: true } });
    for (const g of flags) {
      if (!g.ownerId) continue;
      const term = g.termId === core.t1Id ? t1 : t2;
      await batcher.push({
        userId: g.ownerId,
        type: "grade_flag",
        sourceTable: "GradeFlag",
        sourceId: g.id,
        channel: ["web"] as any,
        message: "A grade flag requires your review.",
        isRead: rng.next() < 0.5,
        createdAt: inTermDate(rng, term.start, term.end),
      });
    }
    await batcher.finish();
  }

  // ---- Audit logs (~60k full / 8k small) ----
  {
    const target = SIZE === "full" ? 60000 : 8000;
    const assignments = await prisma.teacherSubjectAssignment.findMany({ select: { id: true, teacherId: true, termId: true } });
    const asmIds = await prisma.assessment.findMany({ select: { id: true } });
    const refIds = behav.referrals.map((r) => ({ id: r.id, termId: r.termId }));
    const anecIds = behav.anecdotalAll.map((a) => ({ id: a.id, observer: a.observerId, termId: a.termId }));
    const sf10Ids = await prisma.sf10Record.findMany({ select: { id: true }, take: 1000 });
    const owners = acad.allTeachers.map((t) => t.id);
    const batcher = new Batcher("AuditLogs", 2000, (ch) => prisma.auditLog.createMany({ data: ch }) as any);
    const actionPool: { type: string; table: string; w: number }[] = [
      { type: "attendance_submit", table: "AttendanceRecord", w: 30 },
      { type: "grade_lock", table: "FinalGrade", w: 8 },
      { type: "grade_unlock", table: "FinalGrade", w: 3 },
      { type: "create", table: "StudentGrade", w: 12 },
      { type: "update", table: "StudentProfile", w: 10 },
      { type: "referral_status_change", table: "Referral", w: 6 },
      { type: "intervention_approval", table: "Intervention", w: 4 },
      { type: "sf10_update", table: "Sf10Record", w: 5 },
      { type: "account_approval", table: "User", w: 5 },
      { type: "grade_flag_raise", table: "GradeFlag", w: 2 },
      { type: "grade_flag_resolve", table: "GradeFlag", w: 1 },
      { type: "adm_edit", table: "AdmLearnerProfile", w: 3 },
      { type: "session_completed", table: "CounselingSession", w: 3 },
      { type: "report_refresh", table: "ReportSnapshot", w: 1 },
      { type: "delete", table: "Notification", w: 1 },
    ];
    const totalW = actionPool.reduce((a, b) => a + b.w, 0);
    for (let i = 0; i < target; i++) {
      // Spike distribution: 35% June enrollment, 30% Sep grading, 20% Oct, 15% spread.
      const r = rng.next();
      const createdAt = r < 0.35 ? new Date(Date.UTC(2026, 5, rng.int(8, 30), rng.int(7, 16))) : r < 0.65 ? new Date(Date.UTC(2026, 8, rng.int(1, 15), rng.int(7, 17))) : r < 0.85 ? new Date(Date.UTC(2026, 9, rng.int(1, 11), rng.int(7, 17))) : inTermDate(rng, t1.start, t2.end);
      let pick = rng.next() * totalW;
      let sel = actionPool[0];
      for (const a of actionPool) {
        pick -= a.w;
        if (pick <= 0) {
          sel = a;
          break;
        }
      }
      let sourceId = core.principalId;
      let userId = rng.pick(owners.length ? owners : [core.principalId]);
      if (sel.table === "AttendanceRecord" && assignments.length) {
        const a = rng.pick(assignments);
        sourceId = a.id;
        userId = a.teacherId;
      } else if (sel.table === "StudentGrade" && asmIds.length) sourceId = rng.pick(asmIds).id;
      else if (sel.table === "Referral" && refIds.length) {
        const x = rng.pick(refIds);
        sourceId = x.id;
      } else if (sel.table === "Sf10Record" && sf10Ids.length) {
        sourceId = rng.pick(sf10Ids).id;
        userId = registrarId;
      } else if (sel.table === "User" && roster.profiles.length) {
        sourceId = rng.pick(roster.profiles).userId;
        userId = core.principalId;
      }
      // Use anecIds to avoid unused warning + realistic anecdotal edits.
      if (sel.table === "StudentProfile" && anecIds.length && rng.next() < 0.2) {
        const x = rng.pick(anecIds);
        sourceId = x.id;
        sel = { type: "anecdotal_edit", table: "AnecdotalRecord", w: 1 };
        userId = x.observer;
      }
      await batcher.push({
        userId,
        actionType: sel.type as any,
        sourceTable: sel.table,
        sourceId,
        reason: "Seeded system activity.",
        createdAt,
      });
    }
    await batcher.finish();
  }

  // ---- Refresh tokens (small operational set) ----
  {
    const staffUsers = await prisma.user.findMany({ where: { role: { in: ["principal", "registrar", "adviser", "subject_teacher"] } }, select: { id: true }, take: 30 });
    const rows = staffUsers.map((u, i) => ({
      userId: u.id,
      tokenHash: `seedhash_${u.id.slice(-8)}_${i}_${Date.now() % 100000}`,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    }));
    await bulkCreate("RefreshTokens", rows.length, (ch) => prisma.refreshToken.createMany({ data: ch, skipDuplicates: true }) as any, rows, 500);
  }
}
