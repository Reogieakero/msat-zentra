import { prisma } from "../../lib/prisma.js";
import {
  GRADE_LABELS,
  GRADE_ORDER,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export type AnecdotalCategory = "behavioral" | "bullying" | "academic" | "attendance" | "health";

export interface AnecdotalQuery {
  categoryFilter: AnecdotalCategory | null;
  q: string;
  anecdotalTypeFilter: "adm" | "counseling" | null;
  docsOnly: boolean;
  page: number;
  pageSize: number;
}

// Guidance Counselor anecdotal records: ONLY filings an adviser referred to
// guidance_counselor — guidance can never browse the raw anecdotal table.
// Metadata only (category, observer, dates, confidentiality tier, referral
// state). Write-up content stays behind the case-file detail endpoint.
export async function getAnecdotal(ctx: GuidanceContext, query: AnecdotalQuery) {
  const { categoryFilter, q, anecdotalTypeFilter, docsOnly, page, pageSize } = query;
  // Term-scoped: prior-term filings never leak into the active term view.
  const scopeTermId = ctx.termId;

  // Push exact-match filters into the database (same ADM/counseling
  // mapping as GET /api/guidance/referrals, NULL-safe on
  // `escalatedTo`). Free-text search and the docs-only facet stay in
  // memory — they derive from joined names and attachment mime types.
  const anecdotalDbClauses: any[] = [];
  if (categoryFilter) {
    anecdotalDbClauses.push({ anecdotalRecord: { category: categoryFilter } });
  }
  if (anecdotalTypeFilter === "adm") {
    anecdotalDbClauses.push({
      OR: [
        { escalatedTo: "adm_coordinator" },
        { referredToRole: "adm_coordinator" },
      ],
    });
  } else if (anecdotalTypeFilter === "counseling") {
    anecdotalDbClauses.push({
      AND: [
        {
          OR: [
            { escalatedTo: null },
            { escalatedTo: { not: "adm_coordinator" } },
          ],
        },
        { referredToRole: { not: "adm_coordinator" } },
      ],
    });
  }

  const rows = await prisma.referral.findMany({
    // Same desk scope as GET /api/guidance/referrals: direct
    // counseling referrals PLUS ADM-track cases picked for the
    // guidance counselor as consultation reviewer. Otherwise the
    // alerts/referrals counts (ADM + Counseling) never match the
    // anecdotal files, and endorsed ADM cases disappear instead of
    // staying listed with the "with the ADM coordinator" overlay.
    where: {
      ...(scopeTermId ? { termId: scopeTermId } : {}),
      OR: [
        { referredToRole: "guidance_counselor" },
        {
          referredToRole: "adm_coordinator",
          OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
        },
      ],
      ...(anecdotalDbClauses.length ? { AND: anecdotalDbClauses } : {}),
    },
    orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
    take: 1000,
    select: {
      id: true,
      status: true,
      referredToRole: true,
      escalatedTo: true,
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
      // Completed-session documentation for the folder slips: file
      // metadata + URLs only (no notes, outcomes, or reasons).
      counselingSessions: {
        where: { status: "completed" },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          sessionType: true,
          scheduledAt: true,
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
    },
  });

  // Every referred filing reads as its own case file — no dedupe, so
  // the same anecdotal record filed twice (any track) still shows
  // both folders, each with its own status and privacy gate.
  const trackOf = (r: (typeof rows)[number]) =>
    r.escalatedTo === "adm_coordinator" || r.referredToRole === "adm_coordinator"
      ? "ADM"
      : "Counseling";
  const mapped = rows.map((r) => ({
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
    sessionDocs: r.counselingSessions
      .filter((s) => (s.attachments ?? []).length > 0)
      .map((s) => ({
        sessionId: s.id,
        sessionType: s.sessionType,
        date: s.scheduledAt.toISOString().slice(0, 10),
        files: (s.attachments ?? []).map((a) => ({
          id: a.id,
          fileUrl: a.fileUrl,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          uploadedAt: a.uploadedAt.toISOString(),
        })),
      })),
    // Action track, same mapping as GET /api/guidance/referrals:
    // ADM-bound when already escalated toward the ADM coordinator,
    // otherwise regular guidance counseling. Needed so the desk can
    // hide the full report on finished (resolved/dismissed) and
    // endorsed (ADM + in_progress) cases — same overlays as the
    // referrals page.
    referralType: trackOf(r),
  }));

  // Session-documents view: only filings whose sessions carry filed
  // images (the hasDocs facet lives server-side so pages stay dense).
  const filtered = mapped.filter((r) => {
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (anecdotalTypeFilter === "adm" && r.referralType !== "ADM") return false;
    if (anecdotalTypeFilter === "counseling" && r.referralType !== "Counseling") return false;
    if (
      docsOnly &&
      !r.sessionDocs.some((s) =>
        s.files.some((f) => f.mimeType.toLowerCase().startsWith("image/"))
      )
    )
      return false;
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
  // Tile stats stay UNFILTERED; `total` is the filtered pager count.
  const unfilteredTotal = mapped.length;

  const countBy = (cat: string) => mapped.filter((r) => r.category === cat).length;
  const byGrade = GRADE_ORDER.map((g) => ({
    grade: GRADE_LABELS[g] ?? g,
    count: mapped.filter((r) => r.grade === (GRADE_LABELS[g] ?? g)).length,
  }));
  // Top referred students for the rail card — over the full referred
  // scope (same unfiltered base as the other summary totals).
  const topByStudent = new Map<string, { student: string; lrn: string; section: string; count: number }>();
  for (const r of mapped) {
    const key = r.lrn || r.student;
    const entry = topByStudent.get(key) ?? { student: r.student, lrn: r.lrn, section: r.section, count: 0 };
    entry.count += 1;
    topByStudent.set(key, entry);
  }
  const topStudents = [...topByStudent.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    summary: {
      total: mapped.length,
      behavioral: countBy("behavioral"),
      bullying: countBy("bullying"),
      academic: countBy("academic"),
      attendance: countBy("attendance"),
      health: countBy("health"),
      byGrade,
      topStudents,
    },
    records,
    page: safePage,
    pageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
