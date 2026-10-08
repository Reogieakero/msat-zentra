import { prisma } from "../../lib/prisma.js";
import { ADM_STAGE_FLOW, type AdmStage } from "../adm.js";
import { GRADE_LABEL } from "../../modules/adm/adm.repository.js";

export async function getDashboard() {
  const ACTIVE_STAGES: AdmStage[] = [
    "meeting_parents",
    "home_visitation",
    "certification",
    "principal_approval",
  ];

  const [
    stageGroups,
    earlyConsultation,
    pendingSignature,
    signed,
    totalProfiles,
    needsRevision,
    totalReferredProfiles,
    issuedDevices,
    returnedDevices,
    latestProfiles,
  ] = await Promise.all([
    prisma.admLearnerProfile.groupBy({
      by: ["stage"],
      _count: { _all: true },
    }),

    prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        admProfiles: { none: {} },
        NOT: {
          status: "pending",
          consultReviewer: { in: ["nurse", "guidance_counselor"] },
        },
      },
    }),

    prisma.admLearnerProfile.count({
      where: {
        stage: "principal_approval",
        approvedBy: null,
        eligibilityStatus: "eligible",
      },
    }),
    prisma.admLearnerProfile.count({
      where: { approvedBy: { not: null } },
    }),
    prisma.admLearnerProfile.count(),
    prisma.admLearnerProfile.count({
      where: {
        stage: "principal_approval",
        approvedBy: null,
        eligibilityStatus: { not: "eligible" },
      },
    }),
    prisma.admLearnerProfile.count({
      where: { stage: { in: ACTIVE_STAGES } },
    }),
    prisma.admDevice.count({ where: { returnedDate: null } }),
    prisma.admDevice.count({ where: { returnedDate: { not: null } } }),
    prisma.admLearnerProfile.findMany({
      where: { stage: { in: ACTIVE_STAGES } },
      include: {
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
          },
        },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
  ]);

  const countsByStage = new Map(
    stageGroups.map((g) => [g.stage, g._count._all]),
  );
  const stageBreakdown = ADM_STAGE_FLOW.map((s) => ({
    stage: s.stage,
    short: s.label,
    count:
      (countsByStage.get(s.stage) ?? 0) +
      (s.stage === "consultation" ? earlyConsultation : 0),
  }));

  const latestReferred = latestProfiles.map((p) => ({
    id: p.id,
    lrn: p.student.lrn,
    student: p.student.user.fullName,
    grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
    stage: p.stage as
      | "meeting_parents"
      | "home_visitation"
      | "certification"
      | "principal_approval",
    eligibilityStatus: p.eligibilityStatus,
    preparedBy: p.preparedByUser.fullName,
    datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
    approvedBy: p.approvedBy ? "Principal" : null,
    forms: p.forms.map((f) => ({
      id: f.id,
      formType: f.formType,
      title: f.title,
      status: f.status,
      fileUrl: f.fileUrl ?? null,
      notes: f.notes ?? null,
      uploadedAt: f.uploadedAt ? f.uploadedAt.toISOString() : null,
    })),
  }));

  return {
    kpis: { pendingSignature, signed, active: totalProfiles },
    stageBreakdown,
    latestReferred,

    totalReferred: totalReferredProfiles + earlyConsultation,
    needsRevision,
    deviceSummary: { issued: issuedDevices, returned: returnedDevices },
  };
}
