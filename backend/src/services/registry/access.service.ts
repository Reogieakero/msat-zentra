import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import type { RegistryContext } from "./registry.types.js";

export interface AccessListQuery {
  band: GradeLevel[];

  scope: "section" | "request";
  status?: string;
}

export interface AdvisoryIdentityStudent {
  sectionId: string | null;
  lrn: string;
  name: string;
}

export interface AdvisoryIdentityRoster {
  sectionId: string;
  lrn: string;
  name: string;
}

/**
 * Pure helper (unit-tested): advisory identity per section, section
 * profiles first, then roster-only. Sections holding ONLY roster rows
 * (no registered profiles yet — e.g. teacher-enlisted LRNs) still get
 * an identity map, so picked LRNs always resolve to advisees.
 */
export function buildAdvisoryIdentity(
  students: AdvisoryIdentityStudent[],
  rosterEntries: AdvisoryIdentityRoster[],
): Map<string, Map<string, { name: string }>> {
  const studentsBySection = new Map<string, AdvisoryIdentityStudent[]>();
  for (const s of students) {
    const key = s.sectionId ?? "";
    const list = studentsBySection.get(key) ?? [];
    list.push(s);
    studentsBySection.set(key, list);
  }
  const rosterBySection = new Map<string, AdvisoryIdentityRoster[]>();
  for (const r of rosterEntries) {
    const list = rosterBySection.get(r.sectionId) ?? [];
    list.push(r);
    rosterBySection.set(r.sectionId, list);
  }
  const advisoryBySection = new Map<string, Map<string, { name: string }>>();
  for (const sectionId of new Set([...studentsBySection.keys(), ...rosterBySection.keys()])) {
    const map = new Map<string, { name: string }>();
    for (const s of studentsBySection.get(sectionId) ?? []) map.set(s.lrn, { name: s.name });
    for (const x of rosterBySection.get(sectionId) ?? []) {
      if (!map.has(x.lrn)) map.set(x.lrn, { name: x.name });
    }
    advisoryBySection.set(sectionId, map);
  }
  return advisoryBySection;
}

export async function listAccessRequests(query: AccessListQuery) {
  const { band, scope, status: statusFilter } = query;
  const where =
    scope === "section"
      ? {
          section: { gradeLevel: { in: band } },
          ...(statusFilter ? { status: statusFilter } : {}),
        }
      : {
          gradeLevel: { in: band },
          ...(statusFilter ? { status: statusFilter } : {}),
        };

  const rows = await prisma.adviserSf10AccessRequest.findMany({
    where: where as never,
    include: {
      adviser: {
        select: {
          id: true,
          fullName: true,
          staffProfile: { select: { employeeId: true } },
        },
      },
      section: { select: { name: true, ...(scope === "request" ? { gradeLevel: true } : {}) } },
    },
    orderBy: [{ requestedAt: "desc" }],
  });

  const sectionIds = [...new Set(rows.map((r) => r.sectionId).filter((id): id is string => !!id))];
  const [allStudents, allRoster] =
    sectionIds.length > 0
      ? await Promise.all([
          prisma.studentProfile.findMany({
            where: {
              sectionId: { in: sectionIds },
              ...(scope === "request" ? { gradeLevel: { in: band } } : {}),
            },
            select: {
              sectionId: true,
              lrn: true,
              user: { select: { fullName: true } },
            },
            orderBy: { lrn: "asc" },
          }),
          prisma.studentRoster.findMany({
            where: { sectionId: { in: sectionIds } },
            select: { sectionId: true, lrn: true, fullName: true },
            orderBy: { lrn: "asc" },
          }),
        ])
      : [[], []];
  // Advisory identity per section (section profiles first, then roster-only).
  const advisoryBySection = buildAdvisoryIdentity(
    allStudents.map((s) => ({ sectionId: s.sectionId, lrn: s.lrn, name: s.user.fullName })),
    allRoster.map((r) => ({ sectionId: r.sectionId, lrn: r.lrn, name: r.fullName })),
  );
  // SF10 lookup runs by LRN across ALL profiles: a record counts even when
  // the profile sits in another section or none (e.g. roster-only advisee
  // whose registered profile is unsectioned).
  const allAdvisoryLrns = [
    ...new Set([...advisoryBySection.values()].flatMap((m) => [...m.keys()])),
  ];
  const globalRecs =
    allAdvisoryLrns.length > 0
      ? await prisma.studentProfile.findMany({
          where: { lrn: { in: allAdvisoryLrns } },
          select: { lrn: true, sf10Records: { select: { status: true } } },
        })
      : [];
  const recByLrn = new Map(globalRecs.map((g) => [g.lrn, g.sf10Records[0] ?? null]));

  const requests = rows.map((r) => {
    const advisory = advisoryBySection.get(r.sectionId ?? "") ?? new Map();
    const picked = new Set(r.requestedLrns ?? []);
    const affectedAdvisees = [...advisory.entries()]
      .filter(([lrn]) => picked.size === 0 || picked.has(lrn))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lrn, ident]) => {
        const rec = recByLrn.get(lrn) ?? null;
        const sf10 = rec?.status;
        return {
          lrn,
          name: ident.name,
          gradeLevel: r.gradeLevel,
          section: r.section.name,
          hasAccount: recByLrn.has(lrn),
          hasRecord: !!rec,
          sf10Status:
            sf10 === "released"
              ? ("validated" as const)
              : sf10 === "available"
                ? ("verified" as const)
                : ("pending" as const),
        };
      });
    const has = affectedAdvisees.filter((a) => a.sf10Status !== "pending").length;
    return {
      id: r.id,
      adviserId: r.adviserId,
      adviserName: r.adviser?.fullName ?? "Unknown adviser",
      employeeId: r.adviser?.staffProfile?.employeeId ?? "—",
      section: r.section?.name ?? "Unsectioned",
      gradeLevel: r.gradeLevel,
      reason: r.reason,
      requestedLrns: [...picked],
      reportedMissingLrns: [...(r.reportedMissingLrns ?? [])],
      approvedLrns: [...(r.approvedLrns ?? [])],
      approvedLrnAt: normalizeApprovedLrnAt(r.approvedLrnAt),
      status: r.status,
      decisionReason: r.decisionReason,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      checkedAt: r.checkedAt?.toISOString() ?? null,
      affectedAdvisees,
      summary: { total: affectedAdvisees.length, has, missing: affectedAdvisees.length - has },
    };
  });

  return { requests };
}

/**
 * Normalize the approvedLrnAt JSON column (LRN → ISO timestamp) into a plain
 * record. Tolerates nulls, arrays, and non-string values.
 */
export function normalizeApprovedLrnAt(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
}

export interface AccessRecordsQuery {
  requestId: string;
  band: GradeLevel[];

  enforceBand: boolean;
}

export interface AccessMatchRecord {
  id: string;
  source: string;
  status: string;
  fileUrl: string | null;
  verifiedAt: string | null;
  validatedAt: string | null;
  currentVersion: number;
}

export interface AccessMatchRow {
  lrn: string;
  name: string;
  hasAccount: boolean;
  record: AccessMatchRecord | null;
}

// Shared matcher: advisory identity (section profiles first, then
// roster-only), picks scoped, SF10 lookup by LRN across ALL profiles.
// Used by both the atomic records read and the streamed verification run
// so row verdicts are identical either way.
async function fetchAccessMatch(
  requestId: string,
  band: GradeLevel[],
  enforceBand: boolean,
): Promise<{ request: { id: string; sectionId: string; gradeLevel: GradeLevel }; rows: AccessMatchRow[] }> {
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id: requestId },
    select: { id: true, sectionId: true, gradeLevel: true, requestedLrns: true },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  const picked = new Set(request.requestedLrns ?? []);

  const [students, rosterEntries] = await Promise.all([
    prisma.studentProfile.findMany({
      where: enforceBand
        ? { sectionId: request.sectionId, gradeLevel: { in: band } }
        : { sectionId: request.sectionId, gradeLevel: request.gradeLevel },
      select: { lrn: true, user: { select: { fullName: true } } },
      orderBy: { lrn: "asc" },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: request.sectionId },
      select: { lrn: true, fullName: true },
      orderBy: { lrn: "asc" },
    }),
  ]);

  // Advisory identity (section profiles first, then roster-only), picks scoped.
  const identity = new Map<string, string>();
  for (const s of students) identity.set(s.lrn, s.user.fullName);
  for (const x of rosterEntries) {
    if (!identity.has(x.lrn)) identity.set(x.lrn, x.fullName);
  }
  let lrns = [...identity.keys()];
  if (picked.size > 0) lrns = lrns.filter((l) => picked.has(l));

  // SF10 lookup by LRN across ALL profiles — a record counts even when the
  // profile sits in another section or none.
  const global =
    lrns.length > 0
      ? await prisma.studentProfile.findMany({
          where: { lrn: { in: lrns } },
          select: {
            lrn: true,
            user: { select: { fullName: true } },
            sf10Records: {
              select: {
                id: true,
                source: true,
                status: true,
                uploadedFileUrl: true,
                verifiedAt: true,
                validatedAt: true,
                currentVersion: true,
              },
            },
          },
        })
      : [];
  const byGlobal = new Map(global.map((g) => [g.lrn, g]));

  const rows = lrns.sort().map((lrn) => {
    const g = byGlobal.get(lrn);
    const rec = g?.sf10Records[0];
    return {
      lrn,
      name: identity.get(lrn) ?? g?.user.fullName ?? lrn,
      hasAccount: !!g,
      record: rec
        ? {
            id: rec.id,
            source: rec.source,
            status: rec.status,
            fileUrl: rec.uploadedFileUrl,
            verifiedAt: rec.verifiedAt?.toISOString() ?? null,
            validatedAt: rec.validatedAt?.toISOString() ?? null,
            currentVersion: rec.currentVersion,
          }
        : null,
    };
  });

  return { request: { id: request.id, sectionId: request.sectionId, gradeLevel: request.gradeLevel as GradeLevel }, rows };
}

export async function getAccessRecords(query: AccessRecordsQuery) {
  const { requestId: id, band, enforceBand } = query;
  const { rows: records } = await fetchAccessMatch(id, band, enforceBand);

  const has = records.filter((x) => x.record).length;
  return { requestId: id, records, summary: { total: records.length, has, missing: records.length - has } };
}

export interface DecideAccessInput {
  requestId: string;
  approved: boolean;
  denyReason?: string;

  enforceBand: boolean;

  denyDefault: string;
}

export interface CheckAccessInput {
  requestId: string;
  band: GradeLevel[];
  enforceBand: boolean;
}

/**
 * Registry verification run: match the requested advisory LRNs against filed
 * SF10 records (attached vs missing) and stamp the request so approval
 * unlocks. Re-runnable — each run overwrites the previous stamp. Only
 * pending requests can be checked.
 */
export async function checkAccessRecords(ctx: RegistryContext, input: CheckAccessInput) {
  const { requestId: id, band, enforceBand } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: { id: true, sectionId: true, gradeLevel: true, status: true, adviserId: true },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");

  const matched = await getAccessRecords({ requestId: id, band, enforceBand });
  const checkedAt = new Date();
  const summary = { ...matched.summary, at: checkedAt.toISOString() };

  await prisma.adviserSf10AccessRequest.update({
    where: { id },
    data: { checkedAt, checkedBy: ctx.userId, checkSummary: summary as never },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "update",
    sourceTable: "adviser_sf10_access_requests",
    sourceId: id,
    reason:
      `SF10 LRN verification: ${matched.summary.has} attached, ` +
      `${matched.summary.missing} missing of ${matched.summary.total} requested`,
  });

  await fanoutNotification({
    userId: request.adviserId,
    sourceTable: "adviser_sf10_access_requests",
    action: "check",
    message:
      `Your SF10 access request is being verified: ${matched.summary.has} ` +
      `attached, ${matched.summary.missing} missing of ${matched.summary.total} requested students.`,
    sourceId: id,
  });

  return { checkedAt: checkedAt.toISOString(), ...matched };
}

export type CheckStreamEvent =
  | { type: "student"; student: AccessMatchRow }
  | {
      type: "done";
      checkedAt: string;
      summary: { total: number; has: number; missing: number };
      reportedMissingLrns: string[];
      approvedLrns: string[];
      approvedLrnAt: Record<string, string>;
      // Full verdicts again: the dock reconciles its rows from this so the
      // list is complete even if a student event was missed mid-stream.
      records: AccessMatchRow[];
    };

export type CheckStreamEmit = (event: CheckStreamEvent) => void | Promise<void>;

/**
 * Streamed verification run: same matching + stamp + audit + notify as the
 * atomic check, but each advisee verdict is emitted as it is produced so
 * the desk dock flips rows one by one instead of waiting for the whole
 * bulk. Re-runnable — each completed run overwrites the previous stamp.
 * Only pending requests can be checked.
 */
export async function checkAccessRecordsStream(
  ctx: RegistryContext,
  input: CheckAccessInput,
  emit: CheckStreamEmit,
  isAborted?: () => boolean,
  /**
   * Runs after the checkedAt stamp commits, before the `done` event is
   * emitted. Routes use it to invalidate list caches first, so a client
   * refetch triggered by `done` can never read stale pre-check rows.
   */
  onCommitted?: () => Promise<void>,
) {
  const { requestId: id, band, enforceBand } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      sectionId: true,
      gradeLevel: true,
      status: true,
      adviserId: true,
      reportedMissingLrns: true,
      approvedLrns: true,
      approvedLrnAt: true,
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");

  const { rows } = await fetchAccessMatch(id, band, enforceBand);
  for (const row of rows) {
    if (isAborted?.()) return;
    await emit({ type: "student", student: row });
    // Yield so each chunk flushes down the wire before the next is built.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  if (isAborted?.()) return;

  const has = rows.filter((x) => x.record).length;
  const summary = { total: rows.length, has, missing: rows.length - has };
  const checkedAt = new Date();

  await prisma.adviserSf10AccessRequest.update({
    where: { id },
    data: { checkedAt, checkedBy: ctx.userId, checkSummary: { ...summary, at: checkedAt.toISOString() } as never },
  });

  // Invalidate before `done` goes out — never fail the stream if it throws.
  if (onCommitted) {
    try {
      await onCommitted();
    } catch (err) {
      console.error("[adviser-access:check] onCommitted failed", err);
    }
  }

  await writeAudit({
    userId: ctx.userId,
    actionType: "update",
    sourceTable: "adviser_sf10_access_requests",
    sourceId: id,
    reason:
      `SF10 LRN verification: ${summary.has} attached, ` +
      `${summary.missing} missing of ${summary.total} requested`,
  });

  await fanoutNotification({
    userId: request.adviserId,
    sourceTable: "adviser_sf10_access_requests",
    action: "check",
    message:
      `Your SF10 access request is being verified: ${summary.has} ` +
      `attached, ${summary.missing} missing of ${summary.total} requested students.`,
    sourceId: id,
  });

  await emit({
    type: "done",
    checkedAt: checkedAt.toISOString(),
    summary,
    reportedMissingLrns: [...(request.reportedMissingLrns ?? [])],
    approvedLrns: [...(request.approvedLrns ?? [])],
    approvedLrnAt: normalizeApprovedLrnAt(request.approvedLrnAt),
    records: rows,
  });
}

export interface ReportMissingInput {
  requestId: string;
  lrn: string;
  band: GradeLevel[];
  enforceBand: boolean;
  /** Desk label for the adviser notification ("record keeper" | "registrar"). */
  deskLabel: string;
}

/** Fire-and-forget side effects (audit + notify) — never block the response. */
function fireSideEffects(promises: Promise<unknown>[], label: string) {
  void Promise.allSettled(promises).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.error(`[adviser-access:${label}] side-effect failed`, r.reason);
      }
    }
  });
}

/**
 * Fast single-LRN matcher: 3 indexed lookups instead of a full-section scan.
 * Returns section membership + global SF10 record for one LRN.
 */
async function fetchSingleMatch(
  request: { sectionId: string; requestedLrns: string[] },
  lrn: string,
) {
  const [profSec, rosSec, global] = await Promise.all([
    prisma.studentProfile.findFirst({
      where: { lrn, sectionId: request.sectionId },
      select: { user: { select: { fullName: true } } },
    }),
    prisma.studentRoster.findFirst({
      where: { lrn, sectionId: request.sectionId },
      select: { fullName: true },
    }),
    prisma.studentProfile.findFirst({
      where: { lrn },
      select: {
        user: { select: { fullName: true } },
        sf10Records: {
          select: {
            id: true,
            source: true,
            status: true,
            uploadedFileUrl: true,
            verifiedAt: true,
            validatedAt: true,
            currentVersion: true,
          },
        },
      },
    }),
  ]);
  return { profSec, rosSec, global };
}

/**
 * "Report as missing" for one requested student: stores the LRN mark and
 * notifies the adviser. Independent of the approve/deny verdict — only
 * pending requests can be reported on.
 */
export async function reportMissingAccessRecord(ctx: RegistryContext, input: ReportMissingInput) {
  const { requestId: id, lrn, band, enforceBand, deskLabel } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      sectionId: true,
      gradeLevel: true,
      status: true,
      adviserId: true,
      requestedLrns: true,
      reportedMissingLrns: true,
      section: { select: { name: true } },
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");

  const picked = new Set(request.requestedLrns ?? []);
  const { prof, ros } = await (async () => {
    const m = await fetchSingleMatch(request, lrn);
    return { prof: m.profSec, ros: m.rosSec };
  })();
  if (picked.size > 0 && !picked.has(lrn))
    throw new AppError(400, "NOT_REQUESTED", "This LRN is not part of the access request");
  if (picked.size === 0 && !prof && !ros)
    throw new AppError(404, "LRN_NOT_FOUND", "This LRN is not in the advisory section");
  const learnerName = prof?.user.fullName ?? ros?.fullName ?? lrn;
  const sectionName = request.section?.name ?? "Unsectioned";

  const prev = request.reportedMissingLrns ?? [];
  if (prev.includes(lrn)) return { requestId: id, lrn, reportedMissingLrns: [...prev] };

  const reportedMissingLrns = [...prev, lrn];
  await prisma.adviserSf10AccessRequest.update({
    where: { id },
    data: { reportedMissingLrns },
  });

  fireSideEffects(
    [
      writeAudit({
        userId: ctx.userId,
        actionType: "update",
        sourceTable: "adviser_sf10_access_requests",
        sourceId: id,
        reason: `Reported missing SF10: ${learnerName} (${lrn}) — no filed record`,
      }),
      fanoutNotification({
        userId: request.adviserId,
        sourceTable: "adviser_sf10_access_requests",
        action: "report-missing",
        message:
          `No SF10 on file for ${learnerName} (${lrn}) in ${sectionName} — ` +
          `reported missing by the ${deskLabel} desk.`,
        sourceId: id,
      }),
    ],
    "report-missing",
  );

  return { requestId: id, lrn, reportedMissingLrns };
}

export interface ApproveLrnInput {
  requestId: string;
  lrn: string;
  band: GradeLevel[];
  enforceBand: boolean;
}

/**
 * Per-student approval for one matched student: stored mark + adviser
 * notice. Only matched (record-attached) LRNs can be approved this way —
 * missing ones go through "report as missing". The request itself stays
 * pending; whole-request approval via decideAccess still grants everything.
 */
export async function approveAccessLrn(ctx: RegistryContext, input: ApproveLrnInput) {
  const { requestId: id, lrn, band, enforceBand } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      sectionId: true,
      gradeLevel: true,
      status: true,
      adviserId: true,
      requestedLrns: true,
      approvedLrns: true,
      approvedLrnAt: true,
      checkedAt: true,
      section: { select: { name: true } },
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");
  if (!request.checkedAt)
    throw new AppError(409, "CHECK_REQUIRED", "Run the SF10 records check before approving");

  const picked = new Set(request.requestedLrns ?? []);
  if (picked.size > 0 && !picked.has(lrn))
    throw new AppError(400, "NOT_REQUESTED", "This LRN is not part of the access request");

  // Fast path: single-LRN indexed lookups, no full-section scan.
  const { profSec, rosSec, global } = await fetchSingleMatch(request, lrn);
  if (!profSec && !rosSec && picked.size === 0)
    throw new AppError(404, "LRN_NOT_FOUND", "This LRN is not in the advisory section");
  const rec = global?.sf10Records[0];
  if (!rec)
    throw new AppError(409, "NOT_MATCHED", "Only students with a matched SF10 record can be approved");
  // Picked-but-not-in-section LRNs have no advisory identity — same NOT_MATCHED
  // verdict the bulk matcher produces (row absent).
  if (!profSec && !rosSec)
    throw new AppError(409, "NOT_MATCHED", "Only students with a matched SF10 record can be approved");
  const rowName = profSec?.user.fullName ?? rosSec?.fullName ?? global?.user.fullName ?? lrn;

  const prev = request.approvedLrns ?? [];
  if (prev.includes(lrn)) {
    const at = normalizeApprovedLrnAt(request.approvedLrnAt);
    return { requestId: id, lrn, approvedLrns: [...prev], approvedLrnAt: at };
  }

  const approvedLrns = [...prev, lrn];
  const approvedLrnAt = { ...normalizeApprovedLrnAt(request.approvedLrnAt), [lrn]: new Date().toISOString() };
  await prisma.adviserSf10AccessRequest.update({
    where: { id },
    data: { approvedLrns, approvedLrnAt },
  });

  fireSideEffects(
    [
      writeAudit({
        userId: ctx.userId,
        actionType: "sf10_access_grant",
        sourceTable: "adviser_sf10_access_requests",
        sourceId: id,
        reason: `SF10 read access granted for ${rowName} (${lrn})`,
      }),
      fanoutNotification({
        userId: request.adviserId,
        sourceTable: "adviser_sf10_access_requests",
        action: "approve-lrn",
        message:
          `SF10 access approved for ${rowName} (${lrn}) in ` +
          `${request.section?.name ?? "your section"}.`,
        sourceId: id,
      }),
    ],
    "approve-lrn",
  );

  return { requestId: id, lrn, approvedLrns, approvedLrnAt };
}

export interface ApproveAllInput {
  requestId: string;
  band: GradeLevel[];
  enforceBand: boolean;
}

/**
 * Bulk "approve all": grants every matched student, never reported/missing
 * ones. One audit entry + one summary notice. Request stays pending.
 */
export async function approveAllMatched(ctx: RegistryContext, input: ApproveAllInput) {
  const { requestId: id, band, enforceBand } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      sectionId: true,
      gradeLevel: true,
      status: true,
      adviserId: true,
      requestedLrns: true,
      approvedLrns: true,
      approvedLrnAt: true,
      checkedAt: true,
      section: { select: { name: true } },
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");
  if (!request.checkedAt)
    throw new AppError(409, "CHECK_REQUIRED", "Run the SF10 records check before approving");

  const { rows } = await fetchAccessMatch(id, band, enforceBand);
  const matched = rows.filter((r) => r.record).map((r) => r.lrn);
  const approvedLrns = [...new Set([...(request.approvedLrns ?? []), ...matched])];
  const granted = matched.filter((lrn) => !(request.approvedLrns ?? []).includes(lrn));
  const now = new Date().toISOString();
  const approvedLrnAt = { ...normalizeApprovedLrnAt(request.approvedLrnAt) };
  if (granted.length === 0) return { requestId: id, approvedLrns, granted, approvedLrnAt };

  for (const lrn of granted) approvedLrnAt[lrn] = now;
  await prisma.adviserSf10AccessRequest.update({
    where: { id },
    data: { approvedLrns, approvedLrnAt },
  });

  fireSideEffects(
    [
      writeAudit({
        userId: ctx.userId,
        actionType: "sf10_access_grant",
        sourceTable: "adviser_sf10_access_requests",
        sourceId: id,
        reason: `SF10 read access granted for ${granted.length} matched student${granted.length === 1 ? "" : "s"}`,
      }),
      fanoutNotification({
        userId: request.adviserId,
        sourceTable: "adviser_sf10_access_requests",
        action: "approve-all",
        message:
          `SF10 access approved for ${granted.length} matched student${granted.length === 1 ? "" : "s"} in ` +
          `${request.section?.name ?? "your section"}.`,
        sourceId: id,
      }),
    ],
    "approve-all",
  );

  return { requestId: id, approvedLrns, granted, approvedLrnAt };
}

export async function decideAccess(
  ctx: RegistryContext,
  input: DecideAccessInput,
) {
  const { requestId, approved, denyReason, enforceBand, denyDefault } = input;
  const request = await prisma.adviserSf10AccessRequest.findUnique({
    where: { id: requestId },
    include: {
      adviser: { select: { fullName: true } },
      section: { select: { name: true, ...(enforceBand ? { gradeLevel: true } : {}) } },
    },
  });
  if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Access request not found");
  if (enforceBand && !ctx.band.includes(request.gradeLevel as GradeLevel)) {
    throw new AppError(403, "FORBIDDEN", "Not in desk grade band");
  }
  if (request.status !== "pending")
    throw new AppError(409, "ALREADY_DECIDED", "Request already processed");
  // Approval follows verification: the SF10 LRN check must run first so the
  // decision is based on attached-vs-missing evidence. Deny stays ungated.
  if (approved && !request.checkedAt)
    throw new AppError(
      409,
      "CHECK_REQUIRED",
      "Run the SF10 records check before approving this request",
    );

  const reason = approved ? null : (denyReason ?? denyDefault);

  const updated = await prisma.adviserSf10AccessRequest.update({
    where: { id: requestId },
    data: {
      status: approved ? "approved" : "denied",
      decidedBy: ctx.userId,
      decidedAt: new Date(),
      decisionReason: reason,
    },
    include: { section: { select: { name: true } } },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: approved ? "sf10_access_grant" : "sf10_access_deny",
    sourceTable: "adviser_sf10_access_requests",
    sourceId: updated.id,
    reason: approved ? "SF10 read access granted" : (reason ?? undefined),
  });

  await fanoutNotification({
    userId: updated.adviserId,
    sourceTable: "adviser_sf10_access_requests",
    action: approved ? "approve" : "deny",
    message: approved
      ? `Your request for SF10 read access (${updated.section.name}) was approved.`
      : `Your request for SF10 read access (${updated.section.name}) was denied.`,
    sourceId: updated.id,
  });

  await fanoutNotification({
    userId: ctx.userId,
    sourceTable: "adviser_sf10_access_requests",
    action: "decide_self",
    message: approved
      ? `You granted ${request.adviser?.fullName ?? "the adviser"} (${updated.section.name}) SF10 read access.`
      : `You denied ${request.adviser?.fullName ?? "the adviser"} (${updated.section.name}) SF10 read access.`,
    sourceId: updated.id,
  });

  return {
    id: updated.id,
    status: updated.status,
    decisionReason: updated.decisionReason,
    decidedAt: updated.decidedAt?.toISOString() ?? undefined,
  };
}
