import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification, fanoutToRole } from "../../lib/notify.js";
import { recomputeRisk, recomputeRosterRisk } from "../risk.js";
import {
  actorName,
  assertOwnFolder,
  buildOcForm01Buffer,
  CATEGORY_KEYS,
  CATEGORY_META,
  GRADE_LABEL_OC,
  loadOcForm01Data,
} from "../../modules/anecdotal/anecdotal.repository.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export interface CreateRecordInput {
  studentId: string;
  sectionId: string;
  termId?: string;
  observationDatetime: string;
  descriptionOfIncident: string;
  descriptionOfLocation?: string;
  notesRecommendationsActions?: string;
  classPerformance?: string;
  attendanceSummary?: string;
  category: "behavioral" | "bullying" | "academic" | "attendance" | "health";
  confidentialityLevel: "restricted" | "confidential";
  folderId?: string;
}

export async function createRecord(ctx: AnecdotalContext, input: CreateRecordInput) {
  // A filing can land straight into one of the teacher's own folders.
  if (input.folderId) {
    const folder = await prisma.anecdotalFolder.findUnique({
      where: { id: input.folderId },
      select: { ownerId: true },
    });
    if (!folder || folder.ownerId !== ctx.userId) {
      throw new AppError(404, "FOLDER_NOT_FOUND", "Folder not found");
    }
  }
  // Enlisted students without accounts file under `roster:<id>` — the
  // roster entry must belong to the record's section.
  const rawStudentId = String(input.studentId);
  const isRoster = rawStudentId.startsWith("roster:");
  const rosterId = isRoster ? rawStudentId.slice("roster:".length) : null;
  if (isRoster) {
    const entry = await prisma.studentRoster.findUnique({
      where: { id: rosterId as string },
      select: { sectionId: true },
    });
    if (!entry || entry.sectionId !== String(input.sectionId)) {
      throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found in this section");
    }
  }
  // Session scope wins — a stale stored selection degrades to the
  // explicit body termId rather than failing the filing.
  const filingTermId = ctx.termId ?? String(input.termId ?? "");
  if (!filingTermId) {
    throw new AppError(400, "NO_ACTIVE_TERM", "No active term to file under");
  }
  const record = await prisma.anecdotalRecord.create({
    data: {
      ...input,
      termId: filingTermId,
      studentId: isRoster ? null : rawStudentId,
      rosterId,
      observationDatetime: new Date(input.observationDatetime),
      observerId: ctx.userId,
    },
  });
  await writeAudit({ userId: ctx.userId, actionType: "anecdotal_edit", sourceTable: "anecdotal_records", sourceId: record.id, reason: "Anecdotal record created" });
  // A new behavioral record can flip risk on its own — recompute now so
  // snapshots (and therefore the interventions queue) stay live.
  if (isRoster && rosterId) {
    await recomputeRosterRisk(rosterId, record.termId);
  } else {
    await recomputeRisk(rawStudentId, record.termId);
  }
  // Filer receipt: the bell keeps the filing even before any referral.
  void fanoutNotification({
    userId: ctx.userId,
    sourceTable: "anecdotal_records",
    action: "create_self",
    message: "You filed an anecdotal record.",
    sourceId: record.id,
  });
  return { id: record.id, folderId: record.folderId ?? null };
}

export async function addFollowup(ctx: AnecdotalContext, recordId: string, notes: string) {
  const record = await prisma.anecdotalRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const followup = await prisma.anecdotalRecordFollowup.create({
    data: { anecdotalRecordId: record.id, followupBy: ctx.userId, followupDate: new Date(), notes },
  });
  await fanoutNotification({
    userId: record.observerId, sourceTable: "anecdotal_record_followups", action: "create",
    message: "New follow-up added to an anecdotal record.", sourceId: followup.id,
  });
  return followup;
}

export interface ReferInput {
  referredToRole: "nurse" | "guidance_counselor" | "adm_coordinator" | "principal";
  reason: string;
  consultReviewer?: "nurse" | "guidance_counselor" | "lrpc";
}

export async function referRecord(
  ctx: AnecdotalContext,
  recordId: string,
  input: ReferInput,
  termId: string | null,
) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: { id: true, studentId: true, rosterId: true, sectionId: true },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const section = await prisma.section.findUnique({
    where: { id: record.sectionId },
    select: { adviserId: true, teacherAssignments: { select: { teacherId: true } } },
  });
  const isAdviser = section?.adviserId === ctx.userId;
  const isSubjectTeacher = section?.teacherAssignments.some((a) => a.teacherId === ctx.userId);
  if (!isAdviser && !isSubjectTeacher) {
    throw new AppError(403, "FORBIDDEN", "Only the observer or a teacher in this section may refer from this record");
  }
  if (!termId) {
    throw new AppError(409, "NO_ACTIVE_TERM", "No active term");
  }
  if (input.consultReviewer && input.referredToRole !== "adm_coordinator") {
    throw new AppError(400, "INVALID_ACTION", "A consultation reviewer can only be picked for ADM cases");
  }
  // One open ADM case per student: an ADM referral is rejected while the
  // student already has one that is still open (resolved or cancelled
  // cases no longer block). Other tracks are unaffected.
  if (input.referredToRole === "adm_coordinator") {
    const studentMatch = record.studentId
      ? { studentId: record.studentId }
      : { rosterId: record.rosterId };
    const existingAdm = await prisma.referral.findFirst({
      where: {
        referredToRole: "adm_coordinator",
        status: { notIn: ["dismissed", "resolved"] },
        termId,
        ...studentMatch,
      },
      select: { id: true },
    });
    if (existingAdm) {
      throw new AppError(409, "ADM_CASE_EXISTS", "This student already has an open ADM case — only one ADM referral per student");
    }
  }
  // The referral carries whichever student identity the record holds —
  // registered profile or roster enlistment (no account needed to file).
  const referral = await prisma.referral.create({
    data: { anecdotalRecordId: record.id, referredToRole: input.referredToRole, referredBy: ctx.userId, reason: input.reason, studentId: record.studentId, rosterId: record.rosterId, termId, consultReviewer: input.consultReviewer ?? null },
  });
  await writeAudit({ userId: ctx.userId, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Referred to ${input.referredToRole}${input.consultReviewer ? ` (consult reviewer: ${input.consultReviewer})` : ""}` });
  // Detailed cards name the student + section (record.studentId is a
  // User id for registered students, or a roster enlistment).
  const [filedAccount, filedRoster, filedSection] = await Promise.all([
    record.studentId
      ? prisma.user.findUnique({
          where: { id: record.studentId },
          select: { fullName: true },
        })
      : null,
    record.rosterId
      ? prisma.studentRoster.findUnique({
          where: { id: record.rosterId },
          select: { fullName: true },
        })
      : null,
    prisma.section.findUnique({
      where: { id: record.sectionId },
      select: { name: true },
    }),
  ]);
  const filedName =
    filedAccount?.fullName ?? filedRoster?.fullName ?? "the student";
  const filedWho = filedSection?.name
    ? `${filedName} (${filedSection.name})`
    : filedName;
  const reasonSnippet =
    input.reason.length > 100
      ? `${input.reason.slice(0, 97)}...`
      : input.reason;
  // Realtime handoff (background, off the adviser critical path): the
  // desk that owns the next step gets a sileo toast the moment the
  // referral lands. Best-effort — never delays the 201.
  {
    const actorId = ctx.userId;
    const referralId = (referral as { id: string }).id;
    const role = input.referredToRole as
      | "nurse"
      | "guidance_counselor"
      | "adm_coordinator"
      | "principal";
    const actor = await actorName(ctx.userId);
    const roleMessage: Record<typeof role, string> = {
      adm_coordinator: `${actor} referred ${filedWho} to ADM${input.consultReviewer ? ` (consult: ${input.consultReviewer})` : ""}: ${reasonSnippet}.`,
      nurse: `${actor} referred ${filedWho} to the clinic: ${reasonSnippet}.`,
      guidance_counselor: `${actor} referred ${filedWho} to guidance: ${reasonSnippet}.`,
      principal: `${actor} referred ${filedWho} to the principal: ${reasonSnippet}.`,
    };
    // Step-scoped notify: an ADM case with a nurse/guidance consultation
    // reviewer sits at the reviewer's step, not the coordinator's — the
    // reviewer fanout below is the only desk ping. The coordinator learns
    // about the case when it is endorsed to them. Direct (no reviewer)
    // and lrpc filings still ping the coordinator, since nobody else can
    // act on those.
    const reviewerOwned =
      role === "adm_coordinator" &&
      (input.consultReviewer === "nurse" ||
        input.consultReviewer === "guidance_counselor");
    if (!reviewerOwned) {
      void fanoutToRole(role, {
        sourceTable: "referrals",
        action: "status",
        message: roleMessage[role],
        sourceId: referralId,
        excludeUserId: actorId,
        messageFor: (r) =>
          `${actor} referred ${filedWho} to you, ${r.fullName}${input.consultReviewer ? ` (consult: ${input.consultReviewer})` : ""}: ${reasonSnippet}.`,
      });
    }
    // ADM consultation reviewer acts on the case too — notify them
    // directly. (lrpc has no login role, so only nurse/guidance
    // reviewers fan out.)
    if (
      role === "adm_coordinator" &&
      (input.consultReviewer === "nurse" ||
        input.consultReviewer === "guidance_counselor")
    ) {
      void fanoutToRole(input.consultReviewer, {
        sourceTable: "referrals",
        action: "status",
        message: `New ADM referral needs consultation review — ${filedWho}.`,
        sourceId: referralId,
        excludeUserId: actorId,
        messageFor: (r) =>
          `${actor} referred ${filedWho} to ADM and picked you, ${r.fullName}, for consultation review.`,
      });
    }
    // Filing confirmation for the adviser themselves — the bell badge
    // and inbox message land in realtime; the submit toast is already
    // shown client-side, so the channel suppresses the echo toast.
    const roleLabel: Record<typeof role, string> = {
      adm_coordinator: "ADM Coordinator",
      nurse: "Nurse",
      guidance_counselor: "Guidance Counselor",
      principal: "Principal",
    };
    void fanoutNotification({
      userId: actorId,
      sourceTable: "referrals",
      action: "status",
      message: `Your referral to the ${roleLabel[role]} for ${filedWho} was submitted.`,
      sourceId: referralId,
    });
  }
  return referral;
}

export interface RecordsHeatmapQuery {
  termId?: string;
  schoolYearId?: string | null;
  schoolYearName: string;
}

// Principal: records heatmap source — every section with its students that have
// anecdotal records, including each record's category/severity/follow-up. The
// categories returned here are the canonical backend AnecdotalCategory enum, so
// the heatmap legend and block colors stay wired to the backend. Records filed
// for students with no current account/section slot (transferred out,
// deactivated, or otherwise unenrolled) are included too, grouped under
// per-grade "Unassigned" sections instead of being silently dropped.
export async function getRecordsHeatmap(query: RecordsHeatmapQuery) {
  const { termId, schoolYearId, schoolYearName } = query;
  const where = termId ? { termId } : {};

  const [sections, rosterEntries, records, followups, referrals] = await Promise.all([
    prisma.section.findMany({
      where: schoolYearId ? { schoolYearId } : {},
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        students: {
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true, status: true } },
          },
        },
      },
    }),
    // Enlisted students without accounts — shown with their records too.
    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : {},
      select: { id: true, lrn: true, fullName: true, sectionId: true },
    }),
    prisma.anecdotalRecord.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        rosterId: true,
        sectionId: true,
        observationDatetime: true,
        descriptionOfIncident: true,
        notesRecommendationsActions: true,
        category: true,
        confidentialityLevel: true,
        observer: { select: { fullName: true } },
      },
    }),
    // Batched lookups instead of take:1 correlated sub-queries per record.
    prisma.anecdotalRecordFollowup.groupBy({
      by: ["anecdotalRecordId"],
      where: termId ? { anecdotalRecord: { termId } } : {},
      _count: { _all: true },
    }),
    prisma.referral.findMany({
      where: termId ? { anecdotalRecord: { termId } } : {},
      select: { id: true, anecdotalRecordId: true, status: true },
    }),
  ]);

  // Latest referral per record (matching the old orderBy id desc / take 1).
  const latestReferral = new Map<string, { status: string; id: string }>();
  for (const r of referrals) {
    const prev = latestReferral.get(r.anecdotalRecordId);
    if (!prev || r.id > prev.id) latestReferral.set(r.anecdotalRecordId, { status: r.status, id: r.id });
  }
  const hasFollowup = new Set(
    followups.map((f) => f.anecdotalRecordId)
  );

  const keyOf = (r: { studentId: string | null; rosterId: string | null }) =>
    r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
  const recordByStudent = new Map<string, typeof records>();
  for (const r of records) {
    const key = keyOf(r);
    const arr = recordByStudent.get(key) ?? [];
    arr.push(r);
    recordByStudent.set(key, arr);
  }
  const rosterBySection = new Map<string, typeof rosterEntries>();
  for (const r of rosterEntries) {
    const arr = rosterBySection.get(r.sectionId) ?? [];
    arr.push(r);
    rosterBySection.set(r.sectionId, arr);
  }

  const toBehavioral = (recs: typeof records) =>
    recs.map((r) => {
      const referral = latestReferral.get(r.id);
      return {
        id: r.id,
        date: r.observationDatetime.toISOString().slice(0, 10),
        category: r.category,
        description: r.descriptionOfIncident,
        severity:
          referral?.status === "resolved"
            ? "Low"
            : r.confidentialityLevel === "confidential"
              ? "High"
              : "Moderate",
        staff: r.observer.fullName,
        resolution: r.notesRecommendationsActions ?? "",
        followUp: referral?.status === "resolved"
          ? "Resolved"
          : hasFollowup.has(r.id)
            ? "Monitoring"
            : "Pending",
      };
    });

  const dataSections = sections
    .map((section) => {
      const profileRows = section.students
        .map((st) => {
          const recs = recordByStudent.get(st.userId);
          if (!recs || recs.length === 0) return null;
          return {
            lrn: st.lrn,
            name: st.user.fullName,
            status: st.user.status,
            gradeLevel: section.gradeLevel,
            section: section.name,
            sectionId: section.id,
            behavioral: toBehavioral(recs),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      // Roster-enlisted students without accounts, with records.
      const rosterRows = (rosterBySection.get(section.id) ?? [])
        .map((st) => {
          const recs = recordByStudent.get(`roster:${st.id}`);
          if (!recs || recs.length === 0) return null;
          return {
            lrn: st.lrn,
            name: st.fullName,
            status: "Enlisted",
            gradeLevel: section.gradeLevel,
            section: section.name,
            sectionId: section.id,
            behavioral: toBehavioral(recs),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      const students = [...profileRows, ...rosterRows];
      if (students.length === 0) return null;
      return {
        sectionId: section.id,
        section: section.name,
        gradeLevel: section.gradeLevel,
        students,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Orphan records: filed for students with no current account/section
  // slot, so no profile/roster row above claimed them. Resolve whatever
  // identity is left and surface them — one folder per student — instead
  // of dropping their records.
  const consumed = new Set<string>();
  for (const section of sections) {
    for (const st of section.students) consumed.add(st.userId);
    for (const r of rosterBySection.get(section.id) ?? []) {
      consumed.add(`roster:${r.id}`);
    }
  }
  const orphanKeys = [...recordByStudent.keys()].filter(
    (k): k is string => typeof k === "string" && !consumed.has(k)
  );
  // Records with neither identity attached (should be rare) collapse into
  // a single "Unknown student" folder.
  const nullKeyRecs =
    (recordByStudent as Map<unknown, typeof records>).get(null) ?? [];

  const orphanStudentIds = orphanKeys.filter((k) => !k.startsWith("roster:"));
  const orphanRosterIds = orphanKeys
    .filter((k) => k.startsWith("roster:"))
    .map((k) => k.slice("roster:".length));

  const [orphanProfiles, orphanRosterRows] = await Promise.all([
    orphanStudentIds.length > 0
      ? prisma.studentProfile.findMany({
          where: { userId: { in: orphanStudentIds } },
          select: {
            userId: true,
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true, status: true } },
            section: { select: { id: true, name: true } },
          },
        })
      : [],
    orphanRosterIds.length > 0
      ? prisma.studentRoster.findMany({
          where: { id: { in: orphanRosterIds } },
          select: { id: true, lrn: true, fullName: true, gradeLevel: true, sectionId: true },
        })
      : [],
  ]);

  const profileById = new Map(orphanProfiles.map((p) => [p.userId, p]));
  const rosterById = new Map(orphanRosterRows.map((r) => [r.id, r]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  type OrphanStudent = {
    lrn: string;
    name: string;
    status: string;
    gradeLevel: string;
    section: string;
    sectionId: string;
    behavioral: ReturnType<typeof toBehavioral>;
  };
  const orphansByGrade = new Map<string, OrphanStudent[]>();
  const pushOrphan = (grade: string, row: OrphanStudent) => {
    const arr = orphansByGrade.get(grade) ?? [];
    arr.push(row);
    orphansByGrade.set(grade, arr);
  };

  for (const key of orphanKeys) {
    const recs = recordByStudent.get(key) ?? [];
    if (recs.length === 0) continue;
    const behavioral = toBehavioral(recs);
    const recSection = sectionById.get(recs[0].sectionId);
    if (key.startsWith("roster:")) {
      const r = rosterById.get(key.slice("roster:".length));
      const grade = String(r?.gradeLevel ?? recSection?.gradeLevel ?? "Unassigned");
      pushOrphan(grade, {
        lrn: r?.lrn || "N/A",
        name: r?.fullName ?? "Unknown student",
        status: "Enlisted",
        gradeLevel: grade,
        section: sectionById.get(r?.sectionId ?? "")?.name ?? recSection?.name ?? "Unassigned",
        sectionId: r?.sectionId ?? recs[0].sectionId ?? "unassigned",
        behavioral,
      });
    } else {
      const p = profileById.get(key);
      const grade = String(p?.gradeLevel ?? recSection?.gradeLevel ?? "Unassigned");
      pushOrphan(grade, {
        lrn: p?.lrn || "N/A",
        name: p?.user.fullName ?? "Unknown student",
        status: p?.user.status ?? "inactive",
        gradeLevel: grade,
        section: p?.section?.name ?? recSection?.name ?? "Unassigned",
        sectionId: p?.section?.id ?? recs[0].sectionId ?? "unassigned",
        behavioral,
      });
    }
  }

  if (nullKeyRecs.length > 0) {
    const recSection = sectionById.get(nullKeyRecs[0].sectionId);
    const grade = String(recSection?.gradeLevel ?? "Unassigned");
    pushOrphan(grade, {
      lrn: "N/A",
      name: "Unknown student",
      status: "inactive",
      gradeLevel: grade,
      section: recSection?.name ?? "Unassigned",
      sectionId: recSection?.id ?? "unassigned",
      behavioral: toBehavioral(nullKeyRecs),
    });
  }

  const orphanSections = [...orphansByGrade.entries()].map(([grade, students]) => ({
    sectionId: `unassigned-${grade}`,
    section: "Unassigned",
    gradeLevel: grade,
    students,
  }));

  return {
    schoolYear: schoolYearName,
    sections: [...dataSections, ...orphanSections],
  };
}

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

  const GRADE_LABEL: Record<string, string> = {
    G7: "Grade 7",
    G8: "Grade 8",
    G9: "Grade 9",
    G10: "Grade 10",
    G11: "Grade 11",
    G12: "Grade 12",
  };

  const students = recent.map((r) => ({
    id: r.id,
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
    year: GRADE_LABEL[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
    dateAdded: r.observationDatetime.toISOString().slice(0, 10),
    adviser: r.observer.fullName,
  }));

  return { categories, total, students };
}

export interface ReferableQuery {
  isAdviser: boolean;
  userId: string;
  termId: string | null;
}

// All eligible anecdotal records for the referrals composer, grouped by the
// frontend into one folder per student. Each record carries hasReferral so
// already-referred reports render disabled instead of disappearing. For
// advisers, includes records created by subject teachers about students in
// the adviser's sections. Subject teachers only see their own records.
export async function getReferable(query: ReferableQuery) {
  const { isAdviser, userId, termId: scopeTermId } = query;
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

  // Term-scoped: only filings from the session's active term are
  // referable — prior-term records stay history.
  if (scopeTermId) where.termId = scopeTermId;

  if (isAdviser && sectionIds.length > 0) {
    // Advisers see records for students in their advisory sections.
    // Students can be linked to sections via StudentProfile.sectionId
    // or via the AnecdotalRecord.sectionId (which may differ from
    // StudentProfile.sectionId at creation time).
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
    select: {
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
  return (
    // Roster-only records carry no account: they show for profiling
    // context but cannot be referred until the student registers.
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

export interface FileFolderInput {
  folderId: string | null;
}

// File one of your records into (or out of) your folders. Allowed for the
// observer and the section adviser (the form's signatory).
export async function fileIntoFolder(
  ctx: AnecdotalContext,
  recordId: string,
  input: FileFolderInput,
) {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      observerId: true,
      section: { select: { adviserId: true } },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
  const allowed =
    record.observerId === ctx.userId ||
    record.section.adviserId === ctx.userId;
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Only the observer or section adviser may file this record");
  }
  const folderId: string | null = input.folderId;
  if (folderId) await assertOwnFolder(folderId, ctx.userId);
  const updated = await prisma.anecdotalRecord.update({
    where: { id: record.id },
    data: { folderId },
    select: { id: true, folderId: true },
  });
  return updated;
}

// JSON payload backing the frontend printable OCForm-01 sheet.
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

// Official .xlsx export byte-matching the OCForm-01 template layout.
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
