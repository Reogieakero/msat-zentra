import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { CACHE_TAGS } from "../../lib/cacheTags.js";
import { paginated, clampPage } from "../../lib/pagination.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";
import { advisorySubmissionObjectPath, uploadFile } from "../../lib/storage.js";
import type { ModuleStatus } from "../../modules/teacher/advisory-modules.schemas.js";
import type { AdvisoryContext } from "./advisory.types.js";

export interface LearnerRef {
  key: string;
  studentId: string | null;
  rosterId: string | null;
  name: string;
  lrn: string;
  /** Persisted sprite mascot; null falls back to the `${name}:${lrn}` pick. */
  mascot: string | null;
}

interface SectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

/** Cache tag shared by every advisory-modules read/write. */
export const MODULE_TAGS = [CACHE_TAGS.teacher, "advisory-modules"] as const;

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export type BoardStatus = ModuleStatus | "posted";

/**
 * Module state for the board. General modules are post-only ("posted"). An ADM
 * module is "submitted" only when every ADM learner handed it in; otherwise it
 * is "overdue" once the due date has passed, and "pending" before that.
 */
export function moduleStatusOf(
  kind: "general" | "adm",
  dueDate: Date | null,
  submittedCount: number,
  totalLearners: number,
): BoardStatus {
  if (kind === "general") return "posted";
  if (totalLearners > 0 && submittedCount >= totalLearners) return "submitted";
  if (dueDate && dueDate.getTime() < Date.now()) return "overdue";
  return "pending";
}

/** Per-learner state: the submission is its own signal, the due date the rest. */
function learnerStatusOf(
  dueDate: Date | null,
  submitted: boolean,
): ModuleStatus {
  if (submitted) return "submitted";
  if (dueDate && dueDate.getTime() < Date.now()) return "overdue";
  return "pending";
}

async function resolveSection(
  ctx: AdvisoryContext,
  sectionId?: string,
): Promise<{ section: SectionInfo; sections: SectionInfo[] }> {
  const sections = await adviserSectionsOr404(ctx.userId, ctx.schoolYearId);
  const section = sectionId
    ? sections.find((s) => s.id === sectionId)
    : sections[0];
  if (!section) {
    throw new AppError(404, "SECTION_NOT_FOUND", "Section is not in your advisory");
  }
  return { section, sections };
}

/**
 * Learners in the section. `admOnly` narrows to learners with an ADM case
 * (accounts only — an ADM profile requires a real student account).
 * Roster rows whose LRN already has a StudentProfile are dropped — same merge
 * rule as the advisory list, so a learner never shows up twice.
 */
async function sectionLearners(sectionId: string, admOnly = false): Promise<LearnerRef[]> {
  const [profiles, roster] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId, ...(admOnly ? { admProfiles: { some: {} } } : {}) },
      select: { userId: true, lrn: true, mascot: true, user: { select: { fullName: true } } },
    }),
    admOnly
      ? Promise.resolve([])
      : prisma.studentRoster.findMany({
          where: { sectionId },
          select: { id: true, lrn: true, fullName: true, mascot: true },
        }),
  ]);
  const enrolledLrns = new Set(profiles.map((p) => p.lrn));
  return [
    ...profiles.map((p) => ({
      key: p.userId,
      studentId: p.userId,
      rosterId: null,
      name: p.user.fullName,
      lrn: p.lrn,
      mascot: p.mascot,
    })),
    ...roster
      .filter((r) => !enrolledLrns.has(r.lrn))
      .map((r) => ({
        key: `roster:${r.id}`,
        studentId: null,
        rosterId: r.id,
        name: r.fullName,
        lrn: r.lrn,
        mascot: r.mascot,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listModules(
  ctx: AdvisoryContext,
  query: { page: number; pageSize: number; sectionId?: string; status?: ModuleStatus },
) {
  const { section, sections } = await resolveSection(ctx, query.sectionId);
  const [modules, admLearners] = await Promise.all([
    prisma.advisoryModule.findMany({
      where: { sectionId: section.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    sectionLearners(section.id, true),
  ]);
  const moduleIds = modules.map((m) => m.id);
  const submittedCounts =
    moduleIds.length > 0
      ? await prisma.advisoryModuleSubmission.groupBy({
          by: ["moduleId"],
          where: { moduleId: { in: moduleIds }, submitted: true },
          _count: { _all: true },
        })
      : [];
  const submittedByModule = new Map(
    submittedCounts.map((row) => [row.moduleId, row._count._all]),
  );

  const rows = modules.map((m) => {
    const isAdm = m.kind === "adm";
    const submitted = isAdm ? (submittedByModule.get(m.id) ?? 0) : 0;
    const totalLearners = isAdm ? admLearners.length : 0;
    return {
      id: m.id,
      kind: m.kind,
      moduleName: m.moduleName,
      moduleUrl: m.moduleUrl,
      description: m.description,
      releaseDate: iso(m.releaseDate),
      dueDate: iso(m.dueDate),
      submittedCount: submitted,
      totalLearners,
      status: moduleStatusOf(m.kind, m.dueDate, submitted, totalLearners),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  });

  const counts = {
    all: rows.length,
    submitted: rows.filter((r) => r.status === "submitted").length,
    pending: rows.filter((r) => r.status === "pending").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
  };
  const filtered = query.status ? rows.filter((r) => r.status === query.status) : rows;
  const safePage = clampPage(query.page, filtered.length, query.pageSize);
  const start = (safePage - 1) * query.pageSize;

  return {
    section,
    sections,
    counts,
    ...paginated(filtered.slice(start, start + query.pageSize), filtered.length, safePage, query.pageSize),
  };
}

export async function getModuleSubmissions(
  ctx: AdvisoryContext,
  moduleId: string,
  query: { page: number; pageSize: number; status?: ModuleStatus },
) {
  const module = await loadModule(ctx, moduleId);
  if (module.kind !== "adm") {
    throw new AppError(
      409,
      "SUBMISSIONS_NOT_TRACKED",
      "General modules are post-only — submissions are not tracked for them",
    );
  }
  const { section } = await resolveSection(ctx, module.sectionId);
  const [learners, submissions] = await Promise.all([
    sectionLearners(module.sectionId, true),
    prisma.advisoryModuleSubmission.findMany({ where: { moduleId: module.id } }),
  ]);
  const submissionByKey = new Map(
    submissions.map((s) => [s.studentId ?? `roster:${s.rosterId}`, s]),
  );

  const rows = learners.map((learner) => {
    const submission = submissionByKey.get(learner.key);
    const submitted = submission?.submitted ?? false;
    return {
      key: learner.key,
      studentId: learner.studentId,
      rosterId: learner.rosterId,
      name: learner.name,
      lrn: learner.lrn,
      mascot: learner.mascot,
      submissionUrl: submission?.submissionUrl ?? null,
      submissionKind: submission?.submissionKind ?? "link",
      fileUrl: submission?.fileUrl ?? null,
      fileName: submission?.fileName ?? null,
      submitted,
      submittedAt: iso(submission?.submittedAt ?? null),
      remarks: submission?.remarks ?? null,
      status: learnerStatusOf(module.dueDate, submitted),
    };
  });

  const counts = {
    all: rows.length,
    submitted: rows.filter((r) => r.status === "submitted").length,
    pending: rows.filter((r) => r.status === "pending").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
  };
  const filtered = query.status ? rows.filter((r) => r.status === query.status) : rows;
  const safePage = clampPage(query.page, filtered.length, query.pageSize);
  const start = (safePage - 1) * query.pageSize;

  return {
    module: {
      id: module.id,
      kind: module.kind,
      moduleName: module.moduleName,
      moduleUrl: module.moduleUrl,
      releaseDate: iso(module.releaseDate),
      dueDate: iso(module.dueDate),
      section: section.name,
    },
    counts,
    ...paginated(filtered.slice(start, start + query.pageSize), filtered.length, safePage, query.pageSize),
  };
}

async function loadModule(ctx: AdvisoryContext, moduleId: string) {
  const sections = await adviserSectionsOr404(ctx.userId, ctx.schoolYearId);
  const module = await prisma.advisoryModule.findFirst({
    where: { id: moduleId, sectionId: { in: sections.map((s) => s.id) } },
  });
  if (!module) {
    throw new AppError(404, "MODULE_NOT_FOUND", "Module not found in your advisory");
  }
  return module;
}

export async function createModule(
  ctx: AdvisoryContext,
  input: {
    sectionId?: string;
    kind?: "general" | "adm";
    moduleName: string;
    moduleUrl?: string | null;
    description?: string | null;
    dueDate?: string | null;
  },
) {
  const { section } = await resolveSection(ctx, input.sectionId);
  const moduleUrl = input.moduleUrl?.trim() || null;
  const now = new Date();

  const created = await prisma.advisoryModule.create({
    data: {
      sectionId: section.id,
      kind: input.kind ?? "general",
      moduleName: input.moduleName.trim(),
      moduleUrl,
      description: input.description?.trim() || null,
      // Posting the link releases the module; the date is never typed by hand.
      releaseDate: moduleUrl ? now : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdBy: ctx.userId,
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "create",
    sourceTable: "advisory_modules",
    sourceId: created.id,
    reason: `Module released to ${section.name}: ${created.moduleName}`,
    newValue: {
      kind: created.kind,
      moduleName: created.moduleName,
      moduleUrl: created.moduleUrl,
      dueDate: iso(created.dueDate),
    },
  });
  await invalidateTags([...MODULE_TAGS]);

  return created.id;
}

export async function updateModule(
  ctx: AdvisoryContext,
  moduleId: string,
  input: {
    moduleName?: string;
    moduleUrl?: string | null;
    description?: string | null;
    dueDate?: string | null;
  },
) {
  const module = await loadModule(ctx, moduleId);
  const urlTouched = input.moduleUrl !== undefined;
  const nextUrl =
    input.moduleUrl === undefined
      ? module.moduleUrl
      : input.moduleUrl?.trim() || null;

  const updated = await prisma.advisoryModule.update({
    where: { id: module.id },
    data: {
      ...(input.moduleName !== undefined ? { moduleName: input.moduleName.trim() } : {}),
      ...(urlTouched ? { moduleUrl: nextUrl } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      // Posting the link is what releases the module; keep the original date.
      ...(nextUrl !== null && !module.releaseDate ? { releaseDate: new Date() } : {}),
    },
  });

  await writeAudit({
    userId: ctx.userId,
    actionType: "update",
    sourceTable: "advisory_modules",
    sourceId: module.id,
    reason: `Module updated: ${updated.moduleName}`,
    oldValue: { moduleName: module.moduleName, moduleUrl: module.moduleUrl, dueDate: iso(module.dueDate) },
    newValue: { moduleName: updated.moduleName, moduleUrl: updated.moduleUrl, dueDate: iso(updated.dueDate) },
  });
  await invalidateTags([...MODULE_TAGS]);

  return updated.id;
}

export async function deleteModule(ctx: AdvisoryContext, moduleId: string) {
  const module = await loadModule(ctx, moduleId);
  await prisma.advisoryModule.delete({ where: { id: module.id } });
  await writeAudit({
    userId: ctx.userId,
    actionType: "delete",
    sourceTable: "advisory_modules",
    sourceId: module.id,
    reason: `Module removed: ${module.moduleName}`,
    oldValue: { moduleName: module.moduleName, sectionId: module.sectionId },
  });
  await invalidateTags([...MODULE_TAGS]);
}

/**
 * Record (or update) one learner's submission. Three ways in:
 *  - `link`: pasting the answered-module link records the submission.
 *  - `file`: an uploaded PDF/Word file is the submission (see uploadSubmissionFile).
 *  - `physical`: the answered module was handed to the adviser in person.
 * Clearing the link/file undoes a link/file submission; a physical mark is
 * toggled explicitly.
 */
export async function recordSubmission(
  ctx: AdvisoryContext,
  moduleId: string,
  input: {
    studentId?: string;
    rosterId?: string;
    submissionKind?: "link" | "file" | "physical";
    submissionUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileMimeType?: string | null;
    fileSize?: number | null;
    submitted?: boolean;
    remarks?: string | null;
  },
) {
  const module = await loadModule(ctx, moduleId);
  if (module.kind !== "adm") {
    throw new AppError(
      409,
      "SUBMISSIONS_NOT_TRACKED",
      "General modules are post-only — submissions are not tracked for them",
    );
  }
  const learners = await sectionLearners(module.sectionId, true);
  const key = input.studentId ?? `roster:${input.rosterId}`;
  const learner = learners.find((l) => l.key === key);
  if (!learner) {
    throw new AppError(404, "LEARNER_NOT_FOUND", "Learner is not in this advisory section");
  }

  const existing = await prisma.advisoryModuleSubmission.findFirst({
    where: {
      moduleId: module.id,
      ...(input.studentId ? { studentId: input.studentId } : { rosterId: input.rosterId }),
    },
  });

  const kind =
    input.submissionKind ?? existing?.submissionKind ?? "link";
  const nextUrl =
    input.submissionUrl === undefined
      ? (existing?.submissionUrl ?? null)
      : input.submissionUrl?.trim() || null;
  const nextFileUrl =
    input.fileUrl === undefined
      ? (existing?.fileUrl ?? null)
      : input.fileUrl?.trim() || null;

  // The artefact is the signal: link/file present ⇒ submitted, physical ⇒
  // the explicit tick (defaults to submitted when the adviser files it).
  const nextSubmitted =
    kind === "physical"
      ? (input.submitted ?? existing?.submitted ?? true)
      : kind === "file"
        ? nextFileUrl !== null
        : nextUrl !== null;
  const nextSubmittedAt = nextSubmitted
    ? (existing?.submittedAt ?? new Date())
    : null;

  const data = {
    submissionKind: kind,
    // Keep only the artefact that matches the chosen kind, so switching from
    // a link to a file never leaves a stale link (and vice versa).
    submissionUrl: kind === "link" ? nextUrl : null,
    // A physical hand-in may carry an uploaded proof (learner portal), so keep
    // the file slot for both file and physical submissions.
    fileUrl: kind === "file" || kind === "physical" ? nextFileUrl : null,
    fileName:
      kind === "file" || kind === "physical"
        ? (input.fileName !== undefined
            ? input.fileName?.trim() || null
            : (existing?.fileName ?? null))
        : null,
    fileMimeType:
      kind === "file" || kind === "physical"
        ? (input.fileMimeType !== undefined
            ? input.fileMimeType
            : (existing?.fileMimeType ?? null))
        : null,
    fileSize:
      kind === "file" || kind === "physical"
        ? (input.fileSize !== undefined ? input.fileSize : (existing?.fileSize ?? null))
        : null,
    submitted: nextSubmitted,
    submittedAt: nextSubmittedAt,
    ...(input.remarks !== undefined
      ? { remarks: input.remarks?.trim() || null }
      : {}),
    recordedBy: ctx.userId,
  };

  const saved = existing
    ? await prisma.advisoryModuleSubmission.update({ where: { id: existing.id }, data })
    : await prisma.advisoryModuleSubmission.create({
        data: {
          moduleId: module.id,
          studentId: learner.studentId,
          rosterId: learner.rosterId,
          ...data,
        },
      });

  await writeAudit({
    userId: ctx.userId,
    actionType: existing ? "update" : "create",
    sourceTable: "advisory_module_submissions",
    sourceId: saved.id,
    reason: `Submission recorded for ${learner.name} · ${module.moduleName}`,
    newValue: {
      studentId: learner.studentId,
      rosterId: learner.rosterId,
      submissionKind: saved.submissionKind,
      submitted: saved.submitted,
      submissionUrl: saved.submissionUrl,
      fileUrl: saved.fileUrl,
    },
  });
  await invalidateTags([...MODULE_TAGS]);

  return saved.id;
}

export interface SubmissionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Upload the learner's answered module (PDF/Word) and record it as a submission. */
export async function uploadSubmissionFile(
  ctx: AdvisoryContext,
  moduleId: string,
  input: { studentId?: string; rosterId?: string; remarks?: string | null },
  file: SubmissionFile | undefined,
) {
  if (!file) {
    throw new AppError(400, "BAD_REQUEST", "Attach the answered module file");
  }
  // Validated by multer's filter; guard here too so the service stays safe.
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(file.mimetype) && !["pdf", "doc", "docx"].includes(ext)) {
    throw new AppError(400, "INVALID_FILE", "Only PDF or Word files are accepted");
  }

  const path = advisorySubmissionObjectPath(moduleId, file.originalname);
  const fileUrl = await uploadFile(file.buffer, path, file.mimetype);

  return recordSubmission(ctx, moduleId, {
    ...(input.studentId ? { studentId: input.studentId } : { rosterId: input.rosterId }),
    submissionKind: "file",
    fileUrl,
    fileName: file.originalname.slice(0, 200),
    fileMimeType: file.mimetype,
    fileSize: file.size,
    remarks: input.remarks,
  });
}
