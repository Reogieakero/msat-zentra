import { prisma } from "../../lib/prisma.js";
import { writeAudit } from "../../lib/audit.js";
import { buildOcForm01Buffer, CATEGORY_KEYS, CATEGORY_META, loadOcForm01Data } from "../../modules/anecdotal/anecdotal.repository.js";
import { gradeLabel } from "../../lib/grades.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export interface RecordsSummaryQuery {
  termId?: string;
}

export async function getRecordsSummary(query: RecordsSummaryQuery) {
  const { termId } = query;
  const where = termId ? { termId } : {};

  const [counts, recent] = await Promise.all([
    prisma.anecdotalRecord.groupBy({
      by: ["category"],
      where,
      _count: { _all: true },
    }),
    prisma.anecdotalRecord.findMany({
      where,
      orderBy: { observationDatetime: "desc" },
      take: 5,
      select: {
        id: true,
        category: true,
        observationDatetime: true,
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            section: { select: { name: true } },
            user: { select: { fullName: true } },
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
        observer: { select: { fullName: true } },
      },
    }),
  ]);

  const categories = CATEGORY_KEYS.map((key) => ({
    key,
    label: CATEGORY_META[key]?.label ?? key,
    color: CATEGORY_META[key]?.color ?? "#64748b",
    value: counts.find((c) => c.category === key)?._count._all ?? 0,
  }));

  const total = categories.reduce((s, c) => s + c.value, 0);

  const students = recent.map((r) => ({
    id: r.id,
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
    year: gradeLabel(r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""),
    dateAdded: r.observationDatetime.toISOString().slice(0, 10),
    adviser: r.observer.fullName,
  }));

  return { categories, total, students };
}

export interface ReferableQuery {
  isAdviser: boolean;
  userId: string;
  termId: string | null;
  overview?: boolean;
}

export async function getReferable(query: ReferableQuery) {
  const { isAdviser, userId, termId: scopeTermId, overview } = query;
  let sectionIds: string[] = [];
  if (isAdviser) {
    const sections = await prisma.section.findMany({
      where: { adviserId: userId },
      select: { id: true },
    });
    sectionIds = sections.map((s) => s.id);
  }

  let where: {
    observerId?: string;
    OR?: object[];
    termId?: string;
  } = {};

  if (scopeTermId) where.termId = scopeTermId;

  if (isAdviser && sectionIds.length > 0) {

    where.OR = [
      { observerId: userId },
      { student: { sectionId: { in: sectionIds } } },
      { sectionId: { in: sectionIds } },
    ];
  } else {
    where.observerId = userId;
  }

  const records = await prisma.anecdotalRecord.findMany({
    where: where as never,
    orderBy: { observationDatetime: "desc" },
    take: overview ? 10 : undefined,
    select: overview
      ? {
          id: true,
          observationDatetime: true,
          category: true,
          student: {
            select: {
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          roster: {
            select: { fullName: true, section: { select: { name: true } } },
          },
          section: { select: { name: true } },
        }
      : {
      id: true,
      observationDatetime: true,
      category: true,
      confidentialityLevel: true,
      descriptionOfIncident: true,
      notesRecommendationsActions: true,
      referrals: { select: { id: true } },
      student: {
        select: {
          userId: true,
          lrn: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          section: { select: { name: true } },
        },
      },
      section: { select: { name: true } },
    },
  });
  if (overview) {
    return records.map((r) => ({
      id: r.id,
      observationDate: r.observationDatetime.toISOString().slice(0, 10),
      category: r.category,
      studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
      section: r.student?.section?.name ?? r.roster?.section?.name ?? r.section.name,
    }));
  }
  return (

    records.map((r) => ({
      id: r.id,
      observationDatetime: r.observationDatetime,
      observationDate: r.observationDatetime.toISOString().slice(0, 10),
      category: r.category,
      confidentialityLevel: r.confidentialityLevel,
      incident: r.descriptionOfIncident,
      studentId: r.student?.userId ?? (r.roster ? `roster:${r.roster.id}` : ""),
      studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
      lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
      section: r.student?.section?.name ?? r.roster?.section?.name ?? r.section.name,
      excerpt: r.descriptionOfIncident?.slice(0, 120) ?? "",
      hasReferral: r.referrals.length > 0,
      referralCount: r.referrals.length,
      hasAccount: r.student != null,
    }))
  );
}

export async function getRecordDetail(ctx: AnecdotalContext, recordId: string) {
  const { data, canSign, signature } = await loadOcForm01Data(
    recordId,
    ctx.userId,
    ctx.role,
  );
  const { signatureImage: _omitted, ...sheet } = data;
  void _omitted;
  return { ...sheet, canSign, signature };
}

export async function exportRecord(ctx: AnecdotalContext, recordId: string) {
  const { data, filename, recordId: resolvedId } = await loadOcForm01Data(
    recordId,
    ctx.userId,
    ctx.role,
  );
  const buffer = await buildOcForm01Buffer(data);
  await writeAudit({
    userId: ctx.userId,
    actionType: "anecdotal_edit",
    sourceTable: "anecdotal_records",
    sourceId: resolvedId,
    reason: "OCForm-01 exported",
  });
  return { buffer, filename };
}
