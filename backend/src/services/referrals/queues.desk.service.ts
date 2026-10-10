import { prisma } from "../../lib/prisma.js";
import { sessionCancelledByRole } from "../../lib/sessionActors.js";
import type { ReferralContext } from "./referral.types.js";

export interface QueueListQuery {
  hasPaginationParams: boolean;
  page: number;
  pageSize: number;
  q: string;
  track: string;
  status: string;
  highlight: string;
}

export async function listQueue(ctx: ReferralContext, query: QueueListQuery) {
  const { hasPaginationParams, page, pageSize, q, track, status, highlight } = query;
  const role = ctx.role;

  const scopeTermId = ctx.termId;

  const roleWhere: any =
    role === "nurse"
      ? {
          OR: [
            { referredToRole: "nurse" },
            { status: "escalated", escalatedTo: "nurse" },
            { referredToRole: "adm_coordinator", consultReviewer: "nurse" },
          ],
        }
      : role === "guidance_counselor"
        ? { referredToRole: "guidance_counselor" }
        : role === "adm_coordinator"
          ? {
              OR: [
                { referredToRole: "adm_coordinator" },
                { status: "escalated", escalatedTo: "adm_coordinator" },
              ],
            }
          : undefined;

  const scopeClauses: any[] = [];
  if (roleWhere) scopeClauses.push(roleWhere);
  if (scopeTermId) scopeClauses.push({ termId: scopeTermId });

  if (track === "adm") scopeClauses.push({ referredToRole: "adm_coordinator" });
  else if (track === "clinic")
    scopeClauses.push({ referredToRole: { not: "adm_coordinator" } });

  if (status.trim()) {
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) scopeClauses.push({ status: { in: statuses } });
  }
  const where: any =
    scopeClauses.length === 0
      ? undefined
      : scopeClauses.length === 1
        ? scopeClauses[0]
        : { AND: scopeClauses };

  // True server-side pagination: DB filters + DB search + LIMIT/OFFSET.
  // Never fetch the full queue into memory to filter/sort client-side.
  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const searchWhere: any = q
    ? {
        OR: [
          { reason: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { status: { equals: q } },
          { student: { user: { fullName: { contains: q, mode: "insensitive" } } } },
          { student: { lrn: { contains: q, mode: "insensitive" } } },
          { roster: { fullName: { contains: q, mode: "insensitive" } } },
          { roster: { lrn: { contains: q, mode: "insensitive" } } },
          { anecdotalRecord: { descriptionOfIncident: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};
  const pagedWhere: any =
    scopeClauses.length === 0 && !q
      ? where
      : { AND: [...scopeClauses, ...(q ? [searchWhere] : [])] };

  let unfilteredTotal = 0;
  let filteredTotal = 0;
  let safePage = Math.max(1, page);
  const referrals: any[] = await (async () => {
    // Counts share the exact filtered WHERE so pagination metadata matches.
    const [unfiltered, filtered] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.count({ where: pagedWhere }),
    ]);
    unfilteredTotal = unfiltered;
    filteredTotal = filtered;
    const totalPages = Math.max(1, Math.ceil(filteredTotal / effPageSize));
    safePage = Math.min(safePage, totalPages);
    if (highlight && q === "") {
      // Locate a highlighted row without scanning the table: fetch its
      // position via an id-ordered keyset probe bounded to one lookup.
      const probe = await prisma.referral.findMany({
        where: pagedWhere,
        select: { id: true },
        orderBy: { id: "desc" },
      });
      const idx = probe.findIndex((r) => r.id === highlight);
      if (idx >= 0) safePage = Math.floor(idx / effPageSize) + 1;
    }
    const skip = (safePage - 1) * effPageSize;
    const pageIds = (
      await prisma.referral.findMany({
        where: pagedWhere,
        select: { id: true },
        orderBy: { id: "desc" },
        skip,
        take: effPageSize,
      })
    ).map((r) => r.id);
    if (pageIds.length === 0) return [];
    const pageRows = await prisma.referral.findMany({
      where: { id: { in: pageIds } },
      include: {
        anecdotalRecord: { select: { id: true, observationDatetime: true, descriptionOfIncident: true, category: true } },
        student: { select: { userId: true, lrn: true, user: { select: { fullName: true } }, section: { select: { name: true } } } },
        roster: { select: { id: true, fullName: true, lrn: true, section: { select: { name: true } } } },

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
      },
    });
    const order = new Map(pageIds.map((id, i) => [id, i]));
    return pageRows.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  })();

  const ids = referrals.map((r) => r.id);
  const sessionIds = referrals.flatMap((r: any) => r.counselingSessions.map((s: any) => s.id));
  const logs = ids.length
    ? await prisma.auditLog.findMany({
        where: { sourceTable: "referrals", sourceId: { in: ids } },
        select: { sourceId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const referredAtById = new Map<string, string>();
  for (const log of logs) {
    if (!referredAtById.has(log.sourceId)) {
      referredAtById.set(log.sourceId, log.createdAt.toISOString());
    }
  }

  const dismissedByRole = new Map<string, string>();
  if (ids.length > 0) {
    const dismissalLogs = await prisma.auditLog.findMany({
      where: {
        sourceTable: "referrals",
        sourceId: { in: ids },
        actionType: "referral_dismissed",
      },
      select: { sourceId: true, user: { select: { role: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const log of dismissalLogs) {
      if (!dismissedByRole.has(log.sourceId)) {
        dismissedByRole.set(log.sourceId, String(log.user?.role ?? ""));
      }
    }
  }

  const cancelledByRole = await sessionCancelledByRole(sessionIds);

  const lastActionById = new Map<string, { type: string; at: string }>();
  if (ids.length > 0 || sessionIds.length > 0) {
    const latestLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          ...(ids.length ? [{ sourceTable: "referrals", sourceId: { in: ids } }] : []),
          ...(sessionIds.length ? [{ sourceTable: "counseling_sessions", sourceId: { in: sessionIds } }] : []),
        ],
      },
      select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const sessionToReferral = new Map<string, string>();
    for (const r of referrals) {
      for (const s of r.counselingSessions) sessionToReferral.set(s.id, r.id);
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
  const enriched = referrals
    .map((r) => ({
      ...r,
      counselingSessions: r.counselingSessions.map((s: any) => ({
        ...s,
        cancelledByRole: cancelledByRole.get(s.id) ?? null,
      })),
      referredAt:
        referredAtById.get(r.id) ??
        r.anecdotalRecord?.observationDatetime?.toISOString() ??
        null,
      lastActionAt: lastActionById.get(r.id)?.at ?? null,
      lastActionType: lastActionById.get(r.id)?.type ?? null,
      dismissedByRole: dismissedByRole.get(r.id) ?? null,
    }))

    .sort((a, b) => {
      const at = (a as { referredAt?: string | null }).referredAt ?? "";
      const bt = (b as { referredAt?: string | null }).referredAt ?? "";
      if (at === bt) return 0;
      return bt < at ? -1 : 1;
    });

  // Always return the paginated contract — no unbounded array shape.
  const rows = enriched;
  void hasPaginationParams;
  return {
    data: rows,
    rows,
    referrals: rows,
    total: filteredTotal,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: filteredTotal },
    page: safePage,
    totalPages: Math.max(1, Math.ceil(filteredTotal / effPageSize)),
    limit: effPageSize,
    pageSize: effPageSize,
  };
}
