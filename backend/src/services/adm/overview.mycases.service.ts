import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { ADM_STAGE_FLOW } from "../adm.js";
import { buildCaseTimeline } from "../../modules/referrals/timeline.js";
import type { AdmContext } from "./adm.types.js";

export interface MyCasesQuery {
  q: string;
  page: number;
  pageSize: number;
  highlight: string;
  hasPaginationParams: boolean;
}

export async function getMyCases(ctx: AdmContext, query: MyCasesQuery) {
  const { q, page, pageSize, highlight, hasPaginationParams } = query;
  const teacherId = ctx.userId;
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true },
  });
  if (sections.length === 0 && ctx.role === "adviser") {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  const sectionIds = sections.map((s) => s.id);

  const scopeTermId = ctx.termId;
  const termFilter = scopeTermId ? { termId: scopeTermId } : {};

  // Every ADM case for the adviser's own advisees, regardless of who opened
  // it (guidance/nurse/coordinator) — the monitoring desk tracks the learner,
  // not the referral's author. Only dismissed referrals are hidden.
  const liveReferral: Prisma.ReferralWhereInput = {
    status: { not: "dismissed" },
  };
  // No advisory section → no advisees. A subject-teacher account must not see
  // the whole school's cases just because it has no advisory scope.
  if (sectionIds.length === 0) {
    if (!hasPaginationParams) return [];
    return {
      data: [],
      rows: [],
      cases: [],
      total: 0,
      unfilteredTotal: 0,
      summary: { total: 0, filtered: 0 },
      page: 1,
      totalPages: 1,
      limit: pageSize,
      pageSize,
    };
  }
  const where: Prisma.AdmLearnerProfileWhereInput = {
    student: { sectionId: { in: sectionIds } },
    referral: liveReferral,
    ...termFilter,
  };

  const profiles = await prisma.admLearnerProfile.findMany({
    where,
    select: {
      id: true,
      stage: true,
      eligibilityStatus: true,
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
      referralId: true,
      student: {
        select: {
          userId: true,
          lrn: true,
          gradeLevel: true,
          photoUrl: true,
          mascot: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      referral: {
        select: {
          id: true,
          status: true,
          consultReviewer: true,
          homeVisitations: { select: { id: true } },
        },
      },
      parentMeetings: { select: { attended: true, meetingDatetime: true } },
      modules: { select: { id: true, submitted: true, submissionDate: true } },
      devices: { select: { id: true, returnedDate: true } },
      forms: { select: { formType: true, status: true, uploadedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stageLabel = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

  // Only learners with an opened ADM case (an AdmLearnerProfile) belong on
  // the advisory tracking desk — a referral still waiting on guidance intake
  // has nothing to track yet.
  const referralIds = profiles.map((p) => p.referralId);
  const timelines = await buildCaseTimeline(referralIds);

  const approverIds = [
    ...new Set(
      profiles
        .map((p) => p.approvedBy ?? null)
        .filter((v): v is string => !!v)
    ),
  ];
  const approverRoles = new Map<string, string>();
  if (approverIds.length > 0) {
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, role: true },
    });
    for (const a of approvers) approverRoles.set(a.id, String(a.role));
  }
  const merged = profiles.map((p) => {
      const meetings = p.parentMeetings ?? [];
      const timeline = timelines.get(p.referralId) ?? [];
      timeline.push({
        label: `Moved to the ${stageLabel.get(p.stage) ?? p.stage} stage.`,
        detail: null,
        date: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : "",
        at: p.createdAt ? p.createdAt.toISOString() : "",
        action: "adm_stage",
        byRole: "adm_coordinator",
        source: "case",
        stage: p.stage,
      });
      if (p.approvedBy && p.approvedAt) {
        timeline.push({
          label: "The principal signed the approval.",
          detail: null,
          date: p.approvedAt.toISOString().slice(0, 10),
          at: p.approvedAt.toISOString(),
          action: "adm_approved",
          byRole: approverRoles.get(p.approvedBy) ?? "principal",
          source: "case",
        });
      }
      timeline.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const submittedModules = p.modules.filter((m) => m.submitted);
      const cert = p.forms.find(
        (f) => f.formType === "CERTIFICATION" && f.status === "verified" && f.uploadedAt
      );
      return {
        id: p.id,
        studentId: p.student.userId,
        studentName: p.student.user.fullName,
        lrn: p.student.lrn,
        mascot: p.student.mascot ?? null,
        gradeLevel: p.student.gradeLevel,
        section: p.student.section?.name ?? "",
        photoUrl: p.student.photoUrl ?? null,
        referralId: p.referralId,
        referralStatus: p.referral.status,
        consultReviewer: p.referral.consultReviewer ?? null,
        stage: p.stage,
        stageLabel: stageLabel.get(p.stage) ?? p.stage,
        eligibilityStatus: p.eligibilityStatus,
        approved: !!p.approvedBy,
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
        datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
        meetingAttended: meetings.length > 0 ? meetings.some((m) => m.attended) : null,
        hasHomeVisit: p.referral.homeVisitations.length > 0,
        modulesSubmitted: submittedModules.length,
        modulesTotal: p.modules.length,
        lastModuleAt:
          submittedModules.length > 0 && submittedModules[0].submissionDate
            ? submittedModules
                .map((m) => (m.submissionDate as Date).toISOString())
                .sort()
                .slice(-1)[0]
            : null,
        devicesIssued: p.devices.length,
        devicesReturned: p.devices.filter((d) => d.returnedDate !== null).length,
        certificationIssued: p.forms.some(
          (f) => f.formType === "CERTIFICATION" && f.status === "verified"
        ),
        certificationAt: cert?.uploadedAt
          ? (cert.uploadedAt as Date).toISOString()
          : null,
        lastMeetingAt:
          meetings.length > 0 && meetings[0].meetingDatetime
            ? (meetings[0].meetingDatetime as Date).toISOString()
            : null,
        timeline,
      };
    });

  if (!hasPaginationParams) {
    return merged;
  }

  const unfilteredTotal = merged.length;
  const filtered = q
    ? merged.filter((c) => {
        const hay = [c.studentName, c.lrn, c.section, c.stageLabel, c.referralStatus]
          .filter((v) => typeof v === "string")
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : merged;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  let safePage = Math.min(page, totalPages);
  if (highlight) {
    const idx = filtered.findIndex((c) => {
      const row = c as unknown as { id?: unknown; referralId?: unknown };
      return row.id === highlight || row.referralId === highlight;
    });
    if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
  }
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  return {
    data: rows,
    rows,
    cases: rows,
    total,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: total },
    page: safePage,
    totalPages,
    limit: pageSize,
    pageSize,
  };
}
