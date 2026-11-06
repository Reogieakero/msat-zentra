import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { GRADE_LABEL } from "../../modules/adm/adm.repository.js";
import { AppError } from "../../lib/errors.js";
import type { AdmContext } from "./adm.types.js";

export interface ApprovalsQuery {
  page: number;
  limit: number;
  q: string;
}

export async function listApprovals(ctx: AdmContext, query: ApprovalsQuery) {
  const { page, limit, q } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AdmLearnerProfileWhereInput = {
    approvedBy: { not: null },
    ...(q
      ? {
          OR: [
            { student: { user: { fullName: { contains: q, mode: "insensitive" as const } } } },
            { student: { lrn: { contains: q } } },
            { id: { contains: q } },
            { approvedByUser: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const termId = ctx.termId;

  const [pageItems, total] = await Promise.all([
    prisma.admLearnerProfile.findMany({
      where,
      include: {
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            sectionId: true,
            user: { select: { fullName: true } },
            section: { select: { name: true } },
          },
        },
        approvedByUser: { select: { fullName: true } },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
        modules: { select: { submitted: true } },
        devices: { select: { id: true } },
      },
      orderBy: { approvedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.admLearnerProfile.count({ where }),
  ]);

  const gradeRows = termId
    ? await prisma.finalGrade.findMany({
        where: {
          studentId: { in: pageItems.map((p) => p.studentId) },
          termId,
        },
        select: {
          studentId: true,
          computedAverage: true,
          transmutedGrade: true,
          subject: { select: { name: true, code: true } },
        },
      })
    : [];
  const gradesByStudent = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    if (!g.studentId) continue;
    const arr = gradesByStudent.get(g.studentId) ?? [];
    arr.push(g);
    gradesByStudent.set(g.studentId, arr);
  }

  const out = pageItems.map((p) => {
    const base = {
      id: p.id,
      lrn: p.student.lrn,
      student: p.student.user.fullName,
      grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
      section: p.student.sectionId ?? "",
      sectionName: p.student.section?.name ?? "",
      modulesSubmitted: p.modules.filter((m) => m.submitted).length,
      modulesTotal: p.modules.length,
      devicesIssued: p.devices.length,
      subjectGrades: (gradesByStudent.get(p.studentId) ?? []).map((g) => ({
        subject: g.subject.name,
        code: g.subject.code,
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        belowThreshold: (g.transmutedGrade ?? 100) < 75,
      })),
      eligibilityStatus:
        p.eligibilityStatus === "eligible"
          ? ("eligible" as const)
          : p.eligibilityStatus === "ineligible"
          ? ("ineligible" as const)
          : ("pending" as const),
      preparedBy: p.preparedByUser.fullName,
      approvedBy: p.approvedByUser?.fullName ?? "Principal",
      approvalDate: p.approvedAt ? p.approvedAt.toISOString().slice(0, 10) : null,
      forms: p.forms.map((f) => ({
        id: f.id,
        formType: f.formType,
        title: f.title,
        status: f.status,
      })),
    };
    return ctx.role === "principal" ? base : { ...base, studentId: p.studentId };
  });

  return {
    rows: out,
    total,
    unfilteredTotal: total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    limit,
    pageSize: limit,
  };
}

export interface HistoryQuery {
  profileId: string | null;
  referralId: string | null;
}

export async function getHistory(query: HistoryQuery) {
  const { profileId, referralId: referralParam } = query;
  if (!profileId && !referralParam) {
    throw new AppError(400, "ID_REQUIRED", "profileId or referralId is required");
  }
  let referralId = referralParam;
  let deviceIds: string[] = [];
  if (profileId) {
    const profile = await prisma.admLearnerProfile.findUnique({
      where: { id: profileId },
      select: { referralId: true, devices: { select: { id: true } } },
    });
    if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
    referralId = profile.referralId;
    deviceIds = profile.devices.map((d) => d.id);
  }
  const ors: { sourceTable: string; sourceId: string }[] = [];
  if (referralId) {

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: { anecdotalRecordId: true },
    });
    if (referral) {
      ors.push({ sourceTable: "anecdotal_records", sourceId: referral.anecdotalRecordId });
    }
    ors.push({ sourceTable: "referrals", sourceId: referralId });
  }
  if (profileId) ors.push({ sourceTable: "adm_learner_profiles", sourceId: profileId });
  for (const deviceId of deviceIds) ors.push({ sourceTable: "adm_devices", sourceId: deviceId });
  const logs = await prisma.auditLog.findMany({
    where: { OR: ors },
    include: { user: { select: { fullName: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return {
    events: logs.map((l) => ({
      id: l.id,
      actionType: String(l.actionType),
      sourceTable: l.sourceTable,
      reason: l.reason,
      oldValue: l.oldValue,
      newValue: l.newValue,
      actor: l.user.fullName,
      actorRole: String(l.user.role),
      at: l.createdAt.toISOString(),
    })),
  };
}
