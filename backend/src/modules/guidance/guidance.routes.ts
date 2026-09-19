import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import {
  computeRiskFactors,
  isAtRisk,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { ADM_STAGE_FLOW, type AdmStage } from "../../services/adm.js";

const router = Router();

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};
const GRADE_ORDER = Object.keys(GRADE_LABELS);

const ADM_LABEL = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

// Guidance Counselor overview: every value computed live from the database —
// no mocked data. Mirrors the principal overview's live risk recompute so the
// numbers agree with the Risk board, but scoped to the guidance workflow:
// referrals routed to guidance, interventions owned by guidance, and ADM
// hand-offs that need counselor action.
//
// Access rule: guidance CANNOT browse raw anecdotal_records. An anecdotal
// filing becomes visible to guidance only once an adviser refers it with
// referredToRole = "guidance_counselor". Every anecdotal-derived figure below
// (category breakdown, latest filings) is therefore computed from referrals
// addressed to guidance — never from a direct anecdotal_records scan.
// Aggregate risk counts (High/Moderate/Low, factor totals) stay status-only
// and never expose write-up content.
router.get(
  "/overview",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "overview"] }),
  async (req, res, next) => {
    try {
      const counselorId = req.user!.id;
      const counselor = await prisma.user.findUnique({
        where: { id: counselorId },
        select: { fullName: true },
      });

      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      const schoolYearId = activeYear?.id;
      const termId = await resolveActiveTermId();
      const term = termId
        ? await prisma.term.findUnique({
            where: { id: termId },
            select: { termNumber: true, schoolYear: { select: { name: true } } },
          })
        : null;
      const termLabel = term
        ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
        : "No active term";

      const [
        referralsOpen,
        referralsLatest,
        interventionsOpen,
        interventionsMine,
        interventionsLatest,
        guidanceReferralsDetailed,
        admActive,
        admHomeVisit,
        admLatest,
        admEarlyDetailed,
        students,
        rosterCohort,
        sectionPopulations,
      ] = await Promise.all([
        prisma.referral.count({
          where: {
            referredToRole: "guidance_counselor",
            status: { in: ["pending", "in_progress"] },
          },
        }),
        prisma.referral.findMany({
          where: { referredToRole: "guidance_counselor" },
          // Referral has no createdAt — newest filing = latest observation date.
          orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
          take: 5,
          select: {
            id: true,
            reason: true,
            status: true,
            referredByUser: { select: { fullName: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
              },
            },
            anecdotalRecord: { select: { category: true, observationDatetime: true } },
          },
        }),
        prisma.intervention.count({
          where: { outcomeStatus: "ongoing" },
        }),
        prisma.intervention.count({
          where: { assignedTo: counselorId, outcomeStatus: "ongoing" },
        }),
        prisma.intervention.findMany({
          where: { outcomeStatus: "ongoing" },
          orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true,
            recommendedAction: true,
            approvalStatus: true,
            outcomeStatus: true,
            riskLevelAtFlag: true,
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
              },
            },
          },
        }),
        // Referral-scoped view of anecdotal filings: only records an adviser
        // explicitly referred to guidance. NOT term-filtered — the overview is
        // a caseload view, and a term mismatch must never hide referred cases.
        prisma.referral.findMany({
          where: { referredToRole: "guidance_counselor" },
          orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
          take: 500,
          select: {
            id: true,
            reason: true,
            status: true,
            referredBy: true,
            anecdotalRecord: {
              select: { category: true, observationDatetime: true },
            },
            referredByUser: { select: { fullName: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
              },
            },
          },
        }),
        prisma.admLearnerProfile.count({
          where: {
            stage: {
              in: ["meeting_parents", "home_visitation", "certification", "principal_approval"],
            },
          },
        }),
        prisma.admLearnerProfile.count({
          where: { stage: "home_visitation" },
        }),
        prisma.admLearnerProfile.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            stage: true,
            eligibilityStatus: true,
            createdAt: true,
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
              },
            },
          },
        }),
        // ADM-track referrals the coordinator hasn't built a learner profile
        // for yet — without this, an adviser ADM referral is counted in the
        // KPI but never listed anywhere on the page. Status-only, newest first.
        prisma.referral.findMany({
          where: {
            referredToRole: "adm_coordinator",
            status: { in: ["pending", "in_progress"] },
            admProfiles: { none: {} },
          },
          orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
          take: 5,
          select: {
            id: true,
            reason: true,
            status: true,
            referredByUser: { select: { fullName: true } },
            anecdotalRecord: { select: { observationDatetime: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
              },
            },
          },
        }),
        prisma.studentProfile.findMany({
          where: schoolYearId ? { section: { schoolYearId } } : undefined,
          select: {
            lrn: true,
            gradeLevel: true,
            section: {
              select: { id: true, name: true, _count: { select: { students: true } } },
            },
            finalGrades: {
              where: termId ? { termId } : undefined,
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: {
              where: termId ? { termId } : undefined,
              select: { status: true },
            },
            anecdotalRecords: {
              where: termId ? { termId } : undefined,
              select: { id: true },
            },
          },
        }),
        prisma.studentRoster.findMany({
          where: schoolYearId ? { schoolYearId } : undefined,
          select: {
            lrn: true,
            gradeLevel: true,
            sectionId: true,
            finalGrades: {
              where: termId ? { termId } : undefined,
              select: { computedAverage: true, transmutedGrade: true },
            },
            attendanceRecords: {
              where: termId ? { termId } : undefined,
              select: { status: true },
            },
            anecdotalRecords: {
              where: termId ? { termId } : undefined,
              select: { id: true },
            },
          },
        }),
        prisma.section.findMany({
          where: schoolYearId ? { schoolYearId } : undefined,
          select: { id: true, name: true, gradeLevel: true, _count: { select: { students: true } } },
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        }),
      ]);

      const headcounts = await sectionHeadcounts(sectionPopulations.map((s) => s.id));
      const sectionById = new Map(sectionPopulations.map((s) => [s.id, s]));

      const registeredLrns = new Set(students.map((s) => s.lrn));
      const riskCohort: {
        gradeLevel: string;
        sectionId: string;
        enrolledFallback: number;
        finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
        attendanceRecords: { status: string }[];
        anecdotalCount: number;
      }[] = [
        ...students.map((s) => ({
          gradeLevel: s.gradeLevel,
          sectionId: s.section?.id ?? "",
          enrolledFallback: s.section?._count.students ?? 0,
          finalGrades: s.finalGrades,
          attendanceRecords: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
        })),
        ...rosterCohort
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => ({
            gradeLevel: r.gradeLevel,
            sectionId: r.sectionId,
            enrolledFallback: 0,
            finalGrades: r.finalGrades,
            attendanceRecords: r.attendanceRecords,
            anecdotalCount: r.anecdotalRecords.length,
          })),
      ];

      let attendance = 0;
      let grades = 0;
      let behavior = 0;
      let high = 0;
      let moderate = 0;
      let low = 0;
      const riskByGrade = new Map<string, number>();
      const highByGrade = new Map<string, number>();
      const atRiskBySection = new Map<string, number>();
      const levelBySection = new Map<string, { high: number; moderate: number; low: number }>();

      for (const s of riskCohort) {
        const flags = computeRiskFactors({
          finalGrades: s.finalGrades,
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalCount,
          enrolled: headcounts.get(s.sectionId) ?? s.enrolledFallback,
        });
        if (flags.attendanceFlag) attendance++;
        if (flags.academicFlag) grades++;
        if (flags.behavioralFlag) behavior++;
        const level = levelFromFlags(flags);
        if (level === "High") high++;
        else if (level === "Moderate") moderate++;
        else low++;

        const bucket = levelBySection.get(s.sectionId) ?? { high: 0, moderate: 0, low: 0 };
        if (level === "High") bucket.high++;
        else if (level === "Moderate") bucket.moderate++;
        else bucket.low++;
        levelBySection.set(s.sectionId, bucket);

        if (isAtRisk(level)) {
          riskByGrade.set(s.gradeLevel, (riskByGrade.get(s.gradeLevel) ?? 0) + 1);
          atRiskBySection.set(s.sectionId, (atRiskBySection.get(s.sectionId) ?? 0) + 1);
        }
        if (level === "High") {
          highByGrade.set(s.gradeLevel, (highByGrade.get(s.gradeLevel) ?? 0) + 1);
        }
      }

      const riskByGradeRows = GRADE_ORDER.map((g) => ({
        grade: GRADE_LABELS[g],
        short: g,
        count: riskByGrade.get(g) ?? 0,
      }));

      const sectionsByGrade = new Map<string, typeof sectionPopulations>();
      for (const s of sectionPopulations) {
        const arr = sectionsByGrade.get(s.gradeLevel) ?? [];
        arr.push(s);
        sectionsByGrade.set(s.gradeLevel, arr);
      }

      const gradeAttention = GRADE_ORDER.map((g) => {
        const secs = sectionsByGrade.get(g) ?? [];
        let topSection = "—";
        let topCount = 0;
        for (const sec of secs) {
          const c = atRiskBySection.get(sec.id) ?? 0;
          if (c > topCount) {
            topCount = c;
            topSection = sec.name;
          }
        }
        return {
          grade: GRADE_LABELS[g],
          short: g,
          sections: secs.length,
          high: highByGrade.get(g) ?? 0,
          atRisk: riskByGrade.get(g) ?? 0,
          topSection,
          topCount,
        };
      });

      const sectionHeat = sectionPopulations.map((s) => {
        const bucket = levelBySection.get(s.id) ?? { high: 0, moderate: 0, low: 0 };
        return {
          section: s.name,
          grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
          ...bucket,
          total: bucket.high + bucket.moderate + bucket.low,
        };
      });

      // Category breakdown over referred cases only — guidance never sees
      // unreferred filings, so this is NOT a school-wide anecdotal census.
      const referredCategoryCounts = new Map<string, number>();
      for (const r of guidanceReferralsDetailed) {
        const cat = r.anecdotalRecord.category;
        referredCategoryCounts.set(cat, (referredCategoryCounts.get(cat) ?? 0) + 1);
      }
      const anecdotalByCategory = ["behavioral", "bullying", "academic", "attendance", "health"].map(
        (cat) => ({
          category: cat,
          count: referredCategoryCounts.get(cat) ?? 0,
        })
      );

      const referralsQueue = referralsLatest.map((r) => ({
        id: r.id,
        student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
        category: r.anecdotalRecord.category,
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        reason: r.reason,
        status: r.status,
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      }));

      const interventionsQueue = interventionsLatest.map((iv) => ({
        id: iv.id,
        student: iv.student?.user.fullName ?? iv.roster?.fullName ?? "Unknown student",
        lrn: iv.student?.lrn ?? iv.roster?.lrn ?? "",
        section: iv.student?.section?.name ?? iv.roster?.section?.name ?? "—",
        action: iv.recommendedAction,
        level: iv.riskLevelAtFlag,
        approval: iv.approvalStatus,
        outcome: iv.outcomeStatus,
      }));

      // Latest filings visible to guidance = latest referrals addressed to
      // guidance, each carrying its linked anecdotal category + referrer.
      // No raw anecdotal row is ever read directly here.
      const latestAlerts = guidanceReferralsDetailed.slice(0, 5).map((r) => ({
        id: r.id,
        student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        category: r.anecdotalRecord.category,
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        reason: r.reason,
        status: r.status,
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      }));

      // ADM hand-offs visible to guidance: tracked learner profiles (newest)
      // plus ADM-track referrals with no profile yet, which sit at the
      // consultation stage until the coordinator builds the profile. Profiles
      // win on ties so the same learner never renders twice.
      const admProfileRows = admLatest.map((p) => ({
        id: p.id,
        student: p.student.user.fullName,
        lrn: p.student.lrn,
        grade: GRADE_LABELS[p.student.gradeLevel] ?? p.student.gradeLevel,
        stage: p.stage,
        stageLabel: ADM_LABEL.get(p.stage) ?? p.stage,
        eligibility: p.eligibilityStatus,
        date: p.createdAt.toISOString().slice(0, 10),
      }));
      const admEarlyRows = admEarlyDetailed.map((r) => ({
        id: `referral:${r.id}`,
        student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
        stage: "consultation",
        stageLabel: ADM_LABEL.get("consultation") ?? "Consultation and referral",
        eligibility: "pending",
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      }));
      const admQueue = [...admProfileRows, ...admEarlyRows]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);

      res.json({
        counselorName: counselor?.fullName ?? "Guidance Counselor",
        termLabel,
        kpis: {
          referredToMe: referralsOpen,
          openInterventions: interventionsOpen,
          myInterventions: interventionsMine,
          highRisk: high,
          admHandoffs: admActive + admEarlyDetailed.length,
          admHomeVisitation: admHomeVisit,
        },
        riskByLevel: { high, moderate, low },
        factorTotals: { attendance, grades, behavior },
        riskByGrade: riskByGradeRows,
        gradeAttention,
        sectionHeat,
        anecdotalByCategory,
        referralsQueue,
        interventionsQueue,
        latestAlerts,
        admQueue,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Guidance Counselor alerts: live system-flagged queue from the shared risk
// engine (academic < 75, attendance < 80%, >= 1 anecdotal this term).
// Status-only rows — student identity, level, tripped factors, referral and
// intervention state. No anecdotal write-up content ever leaves this endpoint:
// the behavioral trigger is a report COUNT, and full filings stay visible
// only after an adviser refers the case (see the referrals queue).
router.get(
  "/alerts",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "alerts"] }),
  async (req, res, next) => {
    try {
      const levelFilter =
        req.query.level === "High" || req.query.level === "Moderate"
          ? (req.query.level as "High" | "Moderate")
          : null;
      const factorFilter =
        req.query.factor === "academic" ||
        req.query.factor === "attendance" ||
        req.query.factor === "behavioral"
          ? (req.query.factor as "academic" | "attendance" | "behavioral")
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

      const activeYear = await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const schoolYearId = activeYear?.id;
      const termId = await resolveActiveTermId();
      const term = termId
        ? await prisma.term.findUnique({
            where: { id: termId },
            select: { termNumber: true, schoolYear: { select: { name: true } } },
          })
        : null;
      const termLabel = term
        ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
        : "No active term";

      const [students, rosterCohort, sectionPopulations, guidanceReferrals, interventions, admProfiles, admReferrals] =
        await Promise.all([
          prisma.studentProfile.findMany({
            where: schoolYearId ? { section: { schoolYearId } } : undefined,
            select: {
              userId: true,
              lrn: true,
              gradeLevel: true,
              section: { select: { id: true, name: true, _count: { select: { students: true } } } },
              user: { select: { fullName: true } },
              finalGrades: {
                where: termId ? { termId } : undefined,
                select: { computedAverage: true, transmutedGrade: true },
              },
              attendanceRecords: {
                where: termId ? { termId } : undefined,
                select: { status: true },
              },
              anecdotalRecords: {
                where: termId ? { termId } : undefined,
                select: { id: true },
              },
            },
          }),
          prisma.studentRoster.findMany({
            where: schoolYearId ? { schoolYearId } : undefined,
            select: {
              id: true,
              lrn: true,
              fullName: true,
              gradeLevel: true,
              sectionId: true,
              section: { select: { name: true } },
              finalGrades: {
                where: termId ? { termId } : undefined,
                select: { computedAverage: true, transmutedGrade: true },
              },
              attendanceRecords: {
                where: termId ? { termId } : undefined,
                select: { status: true },
              },
              anecdotalRecords: {
                where: termId ? { termId } : undefined,
                select: { id: true },
              },
            },
          }),
          prisma.section.findMany({
            where: schoolYearId ? { schoolYearId } : undefined,
            select: { id: true },
          }),
          prisma.referral.findMany({
            where: { referredToRole: "guidance_counselor" },
            select: { studentId: true, rosterId: true, status: true },
          }),
          prisma.intervention.findMany({
            orderBy: { id: "desc" },
            take: 2000,
            select: { studentId: true, rosterId: true, outcomeStatus: true },
          }),
          // ADM track membership (status-only): a tracked learner profile or
          // an ADM-track referral marks the case ADM; everything else is the
          // general guidance caseload.
          prisma.admLearnerProfile.findMany({
            select: { studentId: true, stage: true },
          }),
          prisma.referral.findMany({
            where: { referredToRole: "adm_coordinator" },
            select: { studentId: true, rosterId: true },
          }),
        ]);

      const headcounts = await sectionHeadcounts(sectionPopulations.map((s) => s.id));

      // Latest referral / intervention state per student key.
      const referralByKey = new Map<string, string>();
      for (const r of guidanceReferrals) {
        const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
        if (key && !referralByKey.has(key)) referralByKey.set(key, r.status);
      }
      const interventionByKey = new Map<string, string>();
      for (const iv of interventions) {
        const key = iv.studentId ?? (iv.rosterId ? `roster:${iv.rosterId}` : null);
        if (key && !interventionByKey.has(key)) interventionByKey.set(key, iv.outcomeStatus);
      }
      // ADM stage per student key (tracked profile wins; otherwise any
      // ADM-track referral still marks the case ADM at consultation).
      const admStageByKey = new Map<string, string>();
      for (const p of admProfiles) {
        if (!admStageByKey.has(p.studentId)) admStageByKey.set(p.studentId, p.stage);
      }
      for (const r of admReferrals) {
        const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
        if (key && !admStageByKey.has(key)) admStageByKey.set(key, "consultation");
      }

      const registeredLrns = new Set(students.map((s) => s.lrn));
      const cohort: {
        key: string;
        student: string;
        lrn: string;
        gradeLevel: string;
        sectionId: string;
        section: string;
        enrolledFallback: number;
        finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
        attendanceRecords: { status: string }[];
        anecdotalCount: number;
      }[] = [
        ...students.map((s) => ({
          key: s.userId,
          student: s.user.fullName,
          lrn: s.lrn,
          gradeLevel: s.gradeLevel,
          sectionId: s.section?.id ?? "",
          section: s.section?.name ?? "—",
          enrolledFallback: s.section?._count.students ?? 0,
          finalGrades: s.finalGrades,
          attendanceRecords: s.attendanceRecords,
          anecdotalCount: s.anecdotalRecords.length,
        })),
        ...rosterCohort
          .filter((r) => !registeredLrns.has(r.lrn))
          .map((r) => ({
            key: `roster:${r.id}`,
            student: r.fullName,
            lrn: r.lrn,
            gradeLevel: r.gradeLevel,
            sectionId: r.sectionId,
            section: r.section?.name ?? "—",
            enrolledFallback: 0,
            finalGrades: r.finalGrades,
            attendanceRecords: r.attendanceRecords,
            anecdotalCount: r.anecdotalRecords.length,
          })),
      ];

      const flagged = [];
      let academicTotal = 0;
      let attendanceTotal = 0;
      let behavioralTotal = 0;
      let referredTotal = 0;
      for (const s of cohort) {
        const flags = computeRiskFactors({
          finalGrades: s.finalGrades,
          attendance: s.attendanceRecords,
          anecdotalCount: s.anecdotalCount,
          enrolled: headcounts.get(s.sectionId) ?? s.enrolledFallback,
        });
        const level = levelFromFlags(flags);
        if (!isAtRisk(level)) continue;
        if (flags.academicFlag) academicTotal++;
        if (flags.attendanceFlag) attendanceTotal++;
        if (flags.behavioralFlag) behavioralTotal++;
        const referralStatus = referralByKey.get(s.key) ?? null;
        if (referralStatus) referredTotal++;
        const admStage = admStageByKey.get(s.key) ?? null;
        const triggers: string[] = [];
        if (flags.academicFlag) triggers.push("Academic average below 75");
        if (flags.attendanceFlag) triggers.push("Attendance below 80%");
        if (flags.behavioralFlag)
          triggers.push(
            `${s.anecdotalCount} behavioral report${s.anecdotalCount === 1 ? "" : "s"} filed`
          );
        flagged.push({
          id: s.key,
          student: s.student,
          lrn: s.lrn,
          section: s.section,
          grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
          level,
          flagCount:
            (flags.academicFlag ? 1 : 0) +
            (flags.attendanceFlag ? 1 : 0) +
            (flags.behavioralFlag ? 1 : 0),
          factors: {
            academic: flags.academicFlag,
            attendance: flags.attendanceFlag,
            behavioral: flags.behavioralFlag,
          },
          triggers,
          anecdotalCount: s.anecdotalCount,
          referralStatus,
          interventionOutcome: interventionByKey.get(s.key) ?? null,
          track: admStage ? "adm" : "general",
          admStageLabel: admStage ? (ADM_LABEL.get(admStage as AdmStage) ?? admStage) : null,
        });
      }

      // High first, then most flags, then name — newest risk first.
      flagged.sort(
        (a, b) =>
          (a.level === "High" ? 0 : 1) - (b.level === "High" ? 0 : 1) ||
          b.flagCount - a.flagCount ||
          a.student.localeCompare(b.student)
      );

      const filtered = flagged.filter((a) => {
        if (levelFilter && a.level !== levelFilter) return false;
        if (factorFilter && !a.factors[factorFilter]) return false;
        if (
          q &&
          !`${a.student} ${a.lrn} ${a.section}`.toLowerCase().includes(q)
        )
          return false;
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const alerts = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

      res.json({
        termLabel,
        summary: {
          high: flagged.filter((a) => a.level === "High").length,
          moderate: flagged.filter((a) => a.level === "Moderate").length,
          total: flagged.length,
          academic: academicTotal,
          attendance: attendanceTotal,
          behavioral: behavioralTotal,
          referred: referredTotal,
          unreferred: flagged.length - referredTotal,
        },
        alerts,
        page: safePage,
        pageSize,
        total,
        totalPages,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Guidance Counselor referrals: every behavior / incident report an adviser
// routed to guidance_counselor, newest filing first. Status-only plus the
// referrer's reason and the linked anecdotal category/date — the full
// write-up itself is opened through the case file, never listed here.
router.get(
  "/referrals",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "referrals"] }),
  async (req, res, next) => {
    try {
      const statusFilter =
        req.query.status === "pending" ||
        req.query.status === "in_progress" ||
        req.query.status === "resolved" ||
        req.query.status === "escalated" ||
        req.query.status === "follow_up" ||
        req.query.status === "info_requested" ||
        req.query.status === "dismissed"
          ? (req.query.status as
              | "pending"
              | "in_progress"
              | "resolved"
              | "escalated"
              | "follow_up"
              | "info_requested"
              | "dismissed")
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      // Case type: "ADM" needs ADM action (already moving toward the ADM
      // coordinator via escalation); anything else is regular guidance
      // counseling handled on this desk.
      const typeFilter =
        req.query.type === "adm" || req.query.type === "counseling"
          ? (req.query.type as "adm" | "counseling")
          : null;
      // Session/open gates for the action menus (same one-active-session
      // semantics as the nurse desk; "open" = not resolved or dismissed).
      const bookedFilter = req.query.booked === "1";
      const completedFilter = req.query.completed === "1";
      const openFilter = req.query.open === "1";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      const rows = await prisma.referral.findMany({
        // The desk receives direct counseling referrals PLUS ADM-track
        // cases picked for the guidance counselor as consultation
        // reviewer (same receiver scoping as the ADM page — nurse/LRPC
        // picks never land here). Both tracks render on the referrals
        // page; the mapped `type` below keeps them separable.
        where: {
          OR: [
            { referredToRole: "guidance_counselor" },
            {
              referredToRole: "adm_coordinator",
              OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
            },
          ],
        },
        orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
        take: 1000,
        select: {
          id: true,
          reason: true,
          status: true,
          referredToRole: true,
          notes: true,
          escalationReason: true,
          escalatedTo: true,
          followUpDate: true,
          priority: true,
          intakeNotes: true,
          acceptedAt: true,
          resolutionSummary: true,
          resolvedAt: true,
          referredByUser: { select: { fullName: true } },
          counselingSessions: {
            orderBy: { scheduledAt: "asc" },
            select: {
              id: true,
              sessionType: true,
              scheduledAt: true,
              venue: true,
              status: true,
              sessionNotes: true,
              outcome: true,
              cancelReason: true,
              createdAt: true,
              completedAt: true,
              attachments: {
                orderBy: { uploadedAt: "asc" },
                select: {
                  id: true,
                  fileUrl: true,
                  fileName: true,
                  mimeType: true,
                  fileSize: true,
                  uploadedAt: true,
                },
              },
            },
          },
          anecdotalRecord: {
            select: {
              id: true,
              category: true,
              observationDatetime: true,
              descriptionOfIncident: true,
              descriptionOfLocation: true,
              notesRecommendationsActions: true,
              confidentialityLevel: true,
              observer: { select: { fullName: true } },
            },
          },
          student: {
            select: {
              lrn: true,
              gradeLevel: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          roster: {
            select: {
              lrn: true,
              fullName: true,
              gradeLevel: true,
              section: { select: { name: true } },
            },
          },
        },
      });

      const mapped = rows.map((r) => ({
        id: r.id,
        student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
        // Action track: ADM-bound when already escalated toward the ADM
        // coordinator or arriving on the ADM track picked for guidance,
        // otherwise regular guidance counseling.
        type:
          r.escalatedTo === "adm_coordinator" || r.referredToRole === "adm_coordinator"
            ? "ADM"
            : "Counseling",
        category: r.anecdotalRecord.category,
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        observer: r.anecdotalRecord.observer?.fullName ?? "—",
        reason: r.reason,
        status: r.status,
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
        anecdotalId: r.anecdotalRecord.id,
        anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
        location: r.anecdotalRecord.descriptionOfLocation ?? "",
        recommendations: r.anecdotalRecord.notesRecommendationsActions ?? "",
        confidentiality: r.anecdotalRecord.confidentialityLevel,
        notes: r.notes ?? "",
        escalationReason: r.escalationReason ?? "",
        escalatedTo: r.escalatedTo ?? "",
        followUpDate: r.followUpDate ? r.followUpDate.toISOString().slice(0, 10) : "",
        priority: r.priority ?? "",
        intakeNotes: r.intakeNotes ?? "",
        acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString().slice(0, 10) : "",
        resolutionSummary: r.resolutionSummary ?? "",
        sessions: r.counselingSessions.map((s) => ({
          id: s.id,
          sessionType: s.sessionType,
          scheduledAt: s.scheduledAt.toISOString(),
          date: s.scheduledAt.toISOString().slice(0, 10),
          venue: s.venue ?? "",
          status: s.status,
          sessionNotes: s.sessionNotes ?? "",
          outcome: s.outcome ?? "",
          cancelReason: s.cancelReason ?? "",
          createdAt: s.createdAt.toISOString(),
          completedAt: s.completedAt ? s.completedAt.toISOString().slice(0, 10) : "",
          attachments: (s.attachments ?? []).map((a) => ({
            id: a.id,
            fileUrl: a.fileUrl,
            fileName: a.fileName,
            mimeType: a.mimeType,
            fileSize: a.fileSize,
            uploadedAt: a.uploadedAt.toISOString(),
          })),
        })),
        completedSessions: r.counselingSessions.filter((s) => s.status === "completed").length,
      }));

      // Latest execution per referral: newest audit across the referral row
      // and its sessions (booked/done/cancelled/moved + status changes), so
      // the UI shows when the action ran — never the appointment time.
      const refIds = mapped.map((r) => r.id);
      const sessIds = mapped.flatMap((r) => r.sessions.map((s) => s.id));
      const lastActionById = new Map<string, { type: string; at: string }>();
      if (refIds.length > 0 || sessIds.length > 0) {
        const latestLogs = await prisma.auditLog.findMany({
          where: {
            OR: [
              ...(refIds.length ? [{ sourceTable: "referrals", sourceId: { in: refIds } }] : []),
              ...(sessIds.length ? [{ sourceTable: "counseling_sessions", sourceId: { in: sessIds } }] : []),
            ],
          },
          select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        const sessionToReferral = new Map<string, string>();
        for (const r of mapped) {
          for (const s of r.sessions) sessionToReferral.set(s.id, r.id);
        }
        for (const log of latestLogs) {
          const referralId =
            log.sourceTable === "referrals"
              ? log.sourceId
              : (sessionToReferral.get(log.sourceId) ?? null);
          if (!referralId || lastActionById.has(referralId)) continue;
          lastActionById.set(referralId, {
            type: String(log.actionType),
            at: log.createdAt.toISOString(),
          });
        }
      }
      const withAction = mapped.map((r) => ({
        ...r,
        lastActionAt: lastActionById.get(r.id)?.at ?? null,
        lastActionType: lastActionById.get(r.id)?.type ?? null,
      }));

      const filtered = withAction.filter((r) => {
        if (statusFilter && r.status !== statusFilter) return false;
        if (typeFilter === "adm" && r.type !== "ADM") return false;
        if (typeFilter === "counseling" && r.type !== "Counseling") return false;
        if (bookedFilter && r.sessions.length === 0) return false;
        if (completedFilter && !r.sessions.some((s) => s.status === "completed")) return false;
        if (openFilter && (r.status === "resolved" || r.status === "dismissed")) return false;
        if (
          q &&
          !`${r.student} ${r.lrn} ${r.section} ${r.referredBy} ${r.observer} ${r.reason} ${r.anecdotalExcerpt} ${r.category}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const referrals = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

      res.json({
        summary: {
          total: mapped.length,
          pending: mapped.filter((r) => r.status === "pending").length,
          inProgress: mapped.filter((r) => r.status === "in_progress").length,
          resolved: mapped.filter((r) => r.status === "resolved").length,
          escalated: mapped.filter((r) => r.status === "escalated").length,
          infoRequested: mapped.filter((r) => r.status === "info_requested").length,
          dismissed: mapped.filter((r) => r.status === "dismissed").length,
          followUp: mapped.filter((r) => r.status === "follow_up").length,
          // Per-track totals for the sidebar's separate ADM vs Counseling
          // menus — same statuses, counted only within each type, plus the
          // session/open gates the menus filter on.
          byType: (["Counseling", "ADM"] as const).reduce(
            (acc, type) => {
              const scoped = mapped.filter((r) => r.type === type);
              const open = scoped.filter(
                (r) => r.status !== "resolved" && r.status !== "dismissed"
              );
              acc[type] = {
                pending: scoped.filter((r) => r.status === "pending").length,
                inProgress: scoped.filter((r) => r.status === "in_progress").length,
                followUp: scoped.filter((r) => r.status === "follow_up").length,
                escalated: scoped.filter((r) => r.status === "escalated").length,
                resolved: scoped.filter((r) => r.status === "resolved").length,
                dismissed: scoped.filter((r) => r.status === "dismissed").length,
                booked: scoped.filter((r) => r.sessions.length > 0).length,
                done: scoped.filter((r) =>
                  r.sessions.some((s) => s.status === "completed")
                ).length,
                open: open.length,
              };
              return acc;
            },
            {} as Record<
              "Counseling" | "ADM",
              {
                pending: number;
                inProgress: number;
                followUp: number;
                escalated: number;
                resolved: number;
                dismissed: number;
                booked: number;
                done: number;
                open: number;
              }
            >
          ),
        },
        referrals,
        page: safePage,
        pageSize,
        total,
        totalPages,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Guidance Counselor anecdotal records: ONLY filings an adviser referred to
// guidance_counselor — guidance can never browse the raw anecdotal table.
// Metadata only (category, observer, dates, confidentiality tier, referral
// state). Write-up content stays behind the case-file detail endpoint.
router.get(
  "/anecdotal",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "anecdotal"] }),
  async (req, res, next) => {
    try {
      const categoryFilter =
        req.query.category === "behavioral" ||
        req.query.category === "bullying" ||
        req.query.category === "academic" ||
        req.query.category === "attendance" ||
        req.query.category === "health"
          ? (req.query.category as
              | "behavioral"
              | "bullying"
              | "academic"
              | "attendance"
              | "health")
          : null;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      const rows = await prisma.referral.findMany({
        where: { referredToRole: "guidance_counselor" },
        orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
        take: 1000,
        select: {
          id: true,
          status: true,
          referredByUser: { select: { fullName: true } },
          anecdotalRecord: {
            select: {
              id: true,
              category: true,
              observationDatetime: true,
              confidentialityLevel: true,
              observer: { select: { fullName: true } },
            },
          },
          student: {
            select: {
              lrn: true,
              gradeLevel: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          roster: {
            select: {
              lrn: true,
              fullName: true,
              gradeLevel: true,
              section: { select: { name: true } },
            },
          },
        },
      });

      // One row per referred filing — a record referred twice still reads as
      // one case file; the newest referral state wins.
      const byRecord = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!byRecord.has(r.anecdotalRecord.id)) byRecord.set(r.anecdotalRecord.id, r);
      }
      const mapped = [...byRecord.values()].map((r) => ({
        id: r.anecdotalRecord.id,
        referralId: r.id,
        student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
        category: r.anecdotalRecord.category,
        observer: r.anecdotalRecord.observer?.fullName ?? "—",
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
        confidentiality: r.anecdotalRecord.confidentialityLevel,
        referralStatus: r.status,
      }));

      const filtered = mapped.filter((r) => {
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (
          q &&
          !`${r.student} ${r.lrn} ${r.section} ${r.observer} ${r.referredBy}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const records = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

      const countBy = (cat: string) => mapped.filter((r) => r.category === cat).length;
      res.json({
        summary: {
          total: mapped.length,
          behavioral: countBy("behavioral"),
          bullying: countBy("bullying"),
          academic: countBy("academic"),
          attendance: countBy("attendance"),
          health: countBy("health"),
        },
        records,
        page: safePage,
        pageSize,
        total,
        totalPages,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Guidance Counselor ADM hand-offs: every ADM-track case the counselor needs
// awareness of — tracked learner profiles (any stage) plus ADM-track
// referrals the coordinator hasn't built a profile for yet (consultation).
// Status-only rows: identity, stage, eligibility, parent-meeting flag and
// home-visit flag. No certification details, minutes, or visit notes ever
// leave this endpoint.
//
// Plus the counselor's own actionable consultation queue: referrals advisers
// routed to guidance_counselor that are still open. This is where the
// counselor takes action (counsel, then hand off via POST
// /api/referrals/:id/adm) — once handed off, the case leaves this queue and
// appears in the tracker below as referredToRole = "adm_coordinator".
router.get(
  "/adm",
  requireAuth,
  requireRole("guidance_counselor"),
  cache({ tags: ["guidance", "adm"] }),
  async (req, res, next) => {
    try {
      const validStages = new Set(ADM_STAGE_FLOW.map((s) => s.stage));
      const stageFilter =
        typeof req.query.stage === "string" &&
        validStages.has(req.query.stage as AdmStage)
          ? (req.query.stage as string)
          : "";
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      const [profiles, earlyReferrals, consultationReferrals, consultAudits, counselor] =
        await Promise.all([
        prisma.admLearnerProfile.findMany({
          orderBy: { createdAt: "desc" },
          take: 1000,
          select: {
            id: true,
            stage: true,
            eligibilityStatus: true,
            createdAt: true,
            approvedBy: true,
            approvedAt: true,
            preparedByUser: { select: { fullName: true } },
            parentMeetings: { select: { attended: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            referral: {
              select: {
                id: true,
                status: true,
                reason: true,
                referredByUser: { select: { fullName: true } },
                anecdotalRecord: { select: { observationDatetime: true } },
                homeVisitations: { select: { id: true } },
              },
            },
          },
        }),
        prisma.referral.findMany({
          where: {
            referredToRole: "adm_coordinator",
            admProfiles: { none: {} },
            // Receiver scoping: only cases picked for guidance (plus legacy
            // rows with no stored pick) reach this queue — nurse/LRPC-picked
            // cases never appear here, even read-only.
            OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
          },
          orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
          take: 1000,
          select: {
            id: true,
            status: true,
            reason: true,
            consultReviewer: true,
            referredByUser: { select: { fullName: true } },
            homeVisitations: { select: { id: true } },
            anecdotalRecord: {
              select: {
                id: true,
                category: true,
                observationDatetime: true,
                descriptionOfIncident: true,
                descriptionOfLocation: true,
                notesRecommendationsActions: true,
              },
            },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
              },
            },
          },
        }),
        // Actionable consultation queue: my open guidance referrals —
        // counsel here, then hand off to the ADM coordinator.
        prisma.referral.findMany({
          where: {
            referredToRole: "guidance_counselor",
            status: { in: ["pending", "in_progress"] },
          },
          orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
          take: 100,
          select: {
            id: true,
            status: true,
            reason: true,
            priority: true,
            referredByUser: { select: { fullName: true } },
            anecdotalRecord: {
              select: { category: true, observationDatetime: true },
            },
            counselingSessions: { select: { id: true, status: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
              },
            },
          },
        }),
        // Which early ADM referrals guidance already reviewed — the review
        // writes a marker-prefixed audit reason, so no schema change is
        // needed to tell "waiting on your review" from "with coordinator".
        prisma.auditLog.findMany({
          where: {
            sourceTable: "referrals",
            actionType: { in: ["referral_status_change", "referral_reassigned", "referral_dismissed"] },
            reason: { startsWith: "ADM consultation " },
          },
          select: { sourceId: true, reason: true },
        }),
        // Counselor name for auto-filling the referral form signature line.
        prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { fullName: true },
        }),
      ]);

      const reviewedIds = new Set(
        consultAudits
          .filter((a) => a.reason?.startsWith("ADM consultation "))
          .map((a) => a.sourceId)
      );

      const profileRows = profiles.map((p) => {
        const meetings = p.parentMeetings ?? [];
        return {
          id: p.id,
          student: p.student.user.fullName,
          lrn: p.student.lrn,
          section: p.student.section?.name ?? "—",
          grade: GRADE_LABELS[p.student.gradeLevel] ?? p.student.gradeLevel,
          stage: p.stage,
          stageLabel: ADM_LABEL.get(p.stage as AdmStage) ?? p.stage,
          eligibility: p.eligibilityStatus,
          referralId: p.referral.id,
          referralStatus: p.referral.status,
          reason: p.referral.reason,
          referredBy: p.referral.referredByUser?.fullName ?? "Adviser",
          preparedBy: p.preparedByUser?.fullName ?? "—",
          date:
            p.referral.anecdotalRecord?.observationDatetime
              .toISOString()
              .slice(0, 10) ??
            p.createdAt.toISOString().slice(0, 10),
          meetingAttended:
            meetings.length > 0 ? meetings.some((m) => m.attended) : null,
          hasHomeVisit: p.referral.homeVisitations.length > 0,
          approved: !!p.approvedBy,
          approvedAt: p.approvedAt
            ? p.approvedAt.toISOString().slice(0, 10)
            : null,
        };
      });

      const earlyRows = earlyReferrals.map((r) => ({
        id: `referral:${r.id}`,
        student:
          r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        grade:
          GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ??
          "",
        stage: "consultation",
        stageLabel: ADM_LABEL.get("consultation" as AdmStage) ?? "Consultation and referral",
        eligibility: "pending",
        referralId: r.id,
        referralStatus: r.status,
        reason: r.reason,
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        preparedBy: r.referredByUser?.fullName ?? "Adviser",
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
        meetingAttended: null as boolean | null,
        hasHomeVisit: r.homeVisitations.length > 0,
        approved: false,
        approvedAt: null as string | null,
        // Consultation review context: the linked anecdotal id so the
        // counselor can open the official report, plus whether this case was
        // already decided out of the consultation stage.
        anecdotalId: r.anecdotalRecord.id,
        consultReviewer: r.consultReviewer ?? "guidance_counselor",
        anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
        location: r.anecdotalRecord.descriptionOfLocation ?? "",
        recommendations: r.anecdotalRecord.notesRecommendationsActions ?? "",
        reviewed: reviewedIds.has(r.id),
      }));

      const merged = [...profileRows, ...earlyRows].sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      const countBy = (stage: string) =>
        merged.filter((c) => c.stage === stage).length;
      const summary = {
        total: merged.length,
        consultation: countBy("consultation"),
        meetingParents: countBy("meeting_parents"),
        homeVisitation: countBy("home_visitation"),
        certification: countBy("certification"),
        principalApproval: countBy("principal_approval"),
        needsHomeVisit: merged.filter(
          (c) => c.meetingAttended === false && !c.hasHomeVisit
        ).length,
        awaitingReview: earlyRows.filter((c) => !c.reviewed).length,
      };

      const filtered = merged.filter((c) => {
        if (stageFilter && c.stage !== stageFilter) return false;
        if (
          q &&
          !`${c.student} ${c.lrn} ${c.section} ${c.reason} ${c.referredBy}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const cases = filtered.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
      );

      const consultationQueue = consultationReferrals.map((r) => ({
        id: r.id,
        student:
          r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
        grade:
          GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ??
          "",
        category: r.anecdotalRecord.category,
        reason: r.reason,
        status: r.status,
        priority: r.priority ?? "",
        referredBy: r.referredByUser?.fullName ?? "Adviser",
        date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
        completedSessions: r.counselingSessions.filter(
          (s) => s.status === "completed"
        ).length,
        totalSessions: r.counselingSessions.length,
      }));

      res.json({
        summary: {
          ...summary,
          consultationAction: consultationQueue.length,
        },
        counselorName: counselor?.fullName ?? "Guidance Counselor",
        consultationQueue,
        // Top-section queue: latest ADM cases referred to guidance that still
        // need the counselor's anecdotal review (unfiltered by search).
        reviewQueue: earlyRows.filter((c) => !c.reviewed).slice(0, 3),
        cases,
        page: safePage,
        pageSize,
        total,
        totalPages,
      });
    } catch (e) {
      next(e);
    }
  }
);

// Guidance consultation review on an ADM-purpose referral sitting at the
// consultation stage with no learner profile yet. Per the ADM pipeline the
// consultation stage is owned by guidance — the counselor opens the official
// anecdotal report and decides the next step:
//   - endorse ("Create referral"): consultation done, case stays with the ADM
//     coordinator for the parent meeting (status → in_progress).
//   - reject: the filing doesn't warrant ADM, case is closed without further
//     action (status → dismissed).
const consultReviewSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  outcome: z.enum(["endorse", "reject"]),
  // Optional first session booked alongside an endorsement (same pattern
  // as the nurse ADM review) — standalone booking while pending goes
  // through the shared session endpoints instead.
  clinicSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1).optional(),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

const GUIDANCE_SESSION_TYPES = [
  "individual",
  "parent_conference",
  "group",
  "home_visit",
] as const;

router.post(
  "/adm/referrals/:id/review",
  requireAuth,
  requireRole("guidance_counselor"),
  validate("body", consultReviewSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({
        where: { id: String(req.params.id) },
      });
      if (
        !referral ||
        referral.referredToRole !== "adm_coordinator" ||
        (await prisma.admLearnerProfile.count({
          where: { referralId: referral.id },
        })) > 0
      ) {
        throw new AppError(
          404,
          "NOT_ADM_CONSULTATION",
          "Only an ADM referral awaiting consultation review can be reviewed here"
        );
      }
      // Receiver enforcement: a case picked for the nurse or LRPC cannot be
      // decided from the guidance queue, even if its id is known.
      if (
        referral.consultReviewer &&
        referral.consultReviewer !== "guidance_counselor"
      ) {
        throw new AppError(
          403,
          "NOT_YOUR_QUEUE",
          "This case was routed to another consultation reviewer"
        );
      }
      const { recommendation, outcome } = req.body as {
        recommendation: string;
        outcome: "endorse" | "reject";
      };
      // Endorsing is blocked while a session is still upcoming — finish
      // or cancel it first (covers booked sessions and booked follow-ups).
      if (outcome === "endorse") {
        const active = await prisma.counselingSession.count({
          where: { referralId: referral.id, status: "scheduled" },
        });
        if (active > 0) {
          throw new AppError(
            400,
            "ACTIVE_SESSION_EXISTS",
            "This referral already has a session that is not done yet — finish or cancel it before endorsing"
          );
        }
      }
      // Optional session booked with the endorsement (stays pending-free:
      // the case moves on; the session is worked from the ADM review).
      // Rejects close the case, so a session only ever rides an endorse.
      let sessionAt: Date | null = null;
      let sessionType = "individual";
      let sessionVenue: string | null = null;
      const clinicInput = (req.body as { clinicSession?: unknown }).clinicSession as
        | { scheduledAt?: unknown; sessionType?: unknown; venue?: unknown }
        | undefined;
      if (clinicInput && outcome === "endorse") {
        sessionAt = new Date(String(clinicInput.scheduledAt ?? ""));
        if (Number.isNaN(sessionAt.getTime())) {
          throw new AppError(400, "INVALID_DATE", "Pick a valid date and time for the session");
        }
        if (sessionAt.getTime() <= Date.now()) {
          throw new AppError(400, "INVALID_ACTION", "Session must be set in the future");
        }
        const kind = String(clinicInput.sessionType ?? "individual");
        if (!(GUIDANCE_SESSION_TYPES as readonly string[]).includes(kind)) {
          throw new AppError(400, "INVALID_ACTION", "Unknown session type");
        }
        sessionType = kind;
        sessionVenue =
          typeof clinicInput.venue === "string" && clinicInput.venue.trim()
            ? clinicInput.venue.trim()
            : null;
      }
      const note = `[ADM consult] ${recommendation.trim()}`;
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data:
          outcome === "endorse"
            ? {
                status: "in_progress",
                notes: referral.notes ? `${referral.notes}\n${note}` : note,
              }
            : {
                status: "dismissed",
                notes: referral.notes ? `${referral.notes}\n${note}` : note,
              },
      });
      if (outcome === "endorse") {
        await writeAudit({
          userId: req.user!.id,
          actionType: "referral_status_change",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `ADM consultation endorsed: ${recommendation.trim()}${sessionAt ? " with a session booked" : ""}`,
          oldValue: { status: referral.status },
          newValue: { status: "in_progress" },
        });
        await fanoutNotification({
          userId: req.user!.id,
          sourceTable: "referrals",
          action: "status",
          message: "ADM consultation endorsed — ready for the parent meeting.",
          sourceId: referral.id,
        });
      } else {
        await writeAudit({
          userId: req.user!.id,
          actionType: "referral_dismissed",
          sourceTable: "referrals",
          sourceId: referral.id,
          reason: `ADM consultation rejected: ${recommendation.trim()}`,
          oldValue: { status: referral.status },
          newValue: { status: "dismissed" },
        });
      }
      if (sessionAt) {
        const created = await prisma.counselingSession.create({
          data: {
            referralId: referral.id,
            sessionType,
            scheduledAt: sessionAt,
            venue: sessionVenue,
            status: "scheduled",
            createdBy: req.user!.id,
          },
        });
        await writeAudit({
          userId: req.user!.id,
          actionType: "session_scheduled",
          sourceTable: "counseling_sessions",
          sourceId: created.id,
          reason: "Session booked on ADM consultation endorse",
          oldValue: null,
          newValue: { sessionType: created.sessionType, scheduledAt: created.scheduledAt },
        });
      }
      await invalidateTags([
        "guidance",
        "overview",
        "alerts",
        "referrals",
        "adm",
        "teacher",
      ]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
