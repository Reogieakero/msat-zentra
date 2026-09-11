import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache } from "../../lib/cache.js";
import {
  computeRiskFactors,
  isAtRisk,
  levelFromFlags,
  resolveActiveTermId,
} from "../../services/risk.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";

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

export default router;
