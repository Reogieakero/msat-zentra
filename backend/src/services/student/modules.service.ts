import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { invalidateTags } from "../../lib/cache.js";
import { paginated, clampPage } from "../../lib/pagination.js";
import { advisorySubmissionObjectPath, uploadFile } from "../../lib/storage.js";
import { fanoutNotification } from "../../lib/notify.js";
import { MODULE_TAGS } from "../advisory/modules.service.js";
import type { ModuleStatus } from "../../modules/teacher/advisory-modules.schemas.js";

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Per-learner state, matching the adviser desk: the submission wins, then the due date. */
function learnerStatusOf(dueDate: Date | null, submitted: boolean): ModuleStatus {
  if (submitted) return "submitted";
  if (dueDate && dueDate.getTime() < Date.now()) return "overdue";
  return "pending";
}

export interface StudentCtx {
  userId: string;
}

interface StudentProfile {
  userId: string;
  lrn: string;
  name: string;
  mascot: string | null;
  sectionId: string | null;
  section: { id: string; name: string; gradeLevel: string; adviserId: string | null } | null;
}

async function loadStudent(userId: string): Promise<StudentProfile> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      lrn: true,
      mascot: true,
      sectionId: true,
      user: { select: { fullName: true } },
      section: { select: { id: true, name: true, gradeLevel: true, adviserId: true } },
    },
  });
  if (!profile) {
    throw new AppError(
      404,
      "STUDENT_PROFILE_NOT_FOUND",
      "No learner profile is linked to this account",
    );
  }
  return {
    userId: profile.userId,
    lrn: profile.lrn,
    name: profile.user.fullName,
    mascot: profile.mascot,
    sectionId: profile.sectionId,
    section: profile.section,
  };
}

/** Modules released to the learner's own section, with their own submission state. */
export async function listStudentModules(
  ctx: StudentCtx,
  query: { page: number; pageSize: number; status?: ModuleStatus },
) {
  const profile = await loadStudent(ctx.userId);

  if (!profile.sectionId || !profile.section) {
    return {
      section: null,
      learner: { name: profile.name, lrn: profile.lrn, mascot: profile.mascot },
      counts: { all: 0, submitted: 0, pending: 0, overdue: 0 },
      ...paginated([], 0, 1, query.pageSize),
    };
  }

  const modules = await prisma.advisoryModule.findMany({
    where: { sectionId: profile.sectionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const moduleIds = modules.map((m) => m.id);
  const submissions =
    moduleIds.length > 0
      ? await prisma.advisoryModuleSubmission.findMany({
          where: { moduleId: { in: moduleIds }, studentId: ctx.userId },
        })
      : [];
  const byModule = new Map(submissions.map((s) => [s.moduleId, s]));

  const rows = modules.map((m) => {
    const submission = byModule.get(m.id);
    const tracked = m.kind === "adm";
    const submitted = tracked ? (submission?.submitted ?? false) : false;
    return {
      id: m.id,
      kind: m.kind,
      moduleName: m.moduleName,
      moduleUrl: m.moduleUrl,
      description: m.description,
      releaseDate: iso(m.releaseDate),
      dueDate: iso(m.dueDate),
      // The learner's own answer — never another learner's.
      submitted,
      submissionKind: submission?.submissionKind ?? "link",
      submissionUrl: submission?.submissionUrl ?? null,
      fileUrl: submission?.fileUrl ?? null,
      fileName: submission?.fileName ?? null,
      submittedAt: iso(submission?.submittedAt ?? null),
      remarks: submission?.remarks ?? null,
      status: tracked ? learnerStatusOf(m.dueDate, submitted) : ("posted" as const),
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
    section: profile.section,
    learner: { name: profile.name, lrn: profile.lrn, mascot: profile.mascot },
    counts,
    ...paginated(filtered.slice(start, start + query.pageSize), filtered.length, safePage, query.pageSize),
  };
}

/** Load the learner and confirm the module was released to their own section. */
async function loadStudentModule(ctx: StudentCtx, moduleId: string) {
  const profile = await loadStudent(ctx.userId);
  if (!profile.sectionId) {
    throw new AppError(404, "MODULE_NOT_FOUND", "No modules are released to your section yet");
  }
  const module = await prisma.advisoryModule.findFirst({
    where: { id: moduleId, sectionId: profile.sectionId },
  });
  if (!module) {
    throw new AppError(404, "MODULE_NOT_FOUND", "Module not found in your section");
  }
  if (module.kind !== "adm") {
    throw new AppError(
      409,
      "SUBMISSIONS_NOT_TRACKED",
      "General modules are post-only — there is nothing to submit",
    );
  }
  return { profile, module };
}

async function saveStudentSubmission(
  ctx: StudentCtx,
  moduleId: string,
  input: {
    submissionKind: "link" | "file" | "physical";
    submissionUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileMimeType?: string | null;
    fileSize?: number | null;
    remarks?: string | null;
  },
) {
  const { profile, module } = await loadStudentModule(ctx, moduleId);
  const existing = await prisma.advisoryModuleSubmission.findFirst({
    where: { moduleId: module.id, studentId: ctx.userId },
  });

  const kind = input.submissionKind;
  const now = new Date();
  const data = {
    submissionKind: kind,
    // Keep only the artefact that matches the chosen kind. A physical hand-in
    // may still carry an uploaded proof (photo/PDF), stored in the same slot.
    submissionUrl: kind === "link" ? (input.submissionUrl?.trim() || null) : null,
    fileUrl:
      kind === "file" || kind === "physical"
        ? (input.fileUrl?.trim() || null)
        : null,
    fileName:
      kind === "file" || kind === "physical" ? (input.fileName ?? null) : null,
    fileMimeType:
      kind === "file" || kind === "physical" ? (input.fileMimeType ?? null) : null,
    fileSize:
      kind === "file" || kind === "physical" ? (input.fileSize ?? null) : null,
    submitted: true,
    submittedAt: existing?.submittedAt ?? now,
    remarks: input.remarks?.trim() || existing?.remarks || null,
    recordedBy: ctx.userId,
  };

  const saved = existing
    ? await prisma.advisoryModuleSubmission.update({ where: { id: existing.id }, data })
    : await prisma.advisoryModuleSubmission.create({
        data: {
          moduleId: module.id,
          studentId: ctx.userId,
          rosterId: null,
          ...data,
        },
      });

  await writeAudit({
    userId: ctx.userId,
    actionType: existing ? "update" : "create",
    sourceTable: "advisory_module_submissions",
    sourceId: saved.id,
    reason: `Learner submitted ${module.moduleName}`,
    newValue: {
      moduleId: module.id,
      studentId: ctx.userId,
      submissionKind: saved.submissionKind,
      submitted: saved.submitted,
      submissionUrl: saved.submissionUrl,
      fileUrl: saved.fileUrl,
    },
  });
  await invalidateTags([...MODULE_TAGS]);

  const adviserId = profile.section?.adviserId ?? null;
  if (adviserId && adviserId !== ctx.userId) {
    await fanoutNotification({
      userId: adviserId,
      sourceTable: "advisory_module_submissions",
      action: "submit",
      sourceId: saved.id,
      message: `${profile.name} submitted ${module.moduleName} (${profile.section?.name ?? "advisory"})`,
    });
  }

  return saved.id;
}

/** Learner pastes the answered module's link. */
export async function submitStudentLink(
  ctx: StudentCtx,
  moduleId: string,
  input: { submissionUrl: string; remarks?: string | null },
) {
  return saveStudentSubmission(ctx, moduleId, {
    submissionKind: "link",
    submissionUrl: input.submissionUrl,
    remarks: input.remarks ?? null,
  });
}

/** Learner marks the paper module as handed in, optionally with proof. */
export async function submitStudentPhysical(
  ctx: StudentCtx,
  moduleId: string,
  input: { remarks?: string | null },
) {
  return saveStudentSubmission(ctx, moduleId, {
    submissionKind: "physical",
    remarks: input.remarks ?? null,
  });
}

export interface SubmissionFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Learner uploads their answer (`kind=file`) or a proof of a physical hand-in
 * (`kind=physical`). Answered modules are PDF/Word; proof may also be an image.
 */
export async function uploadStudentSubmission(
  ctx: StudentCtx,
  moduleId: string,
  input: {
    kind: "file" | "physical";
    remarks?: string | null;
  },
  file: SubmissionFile | undefined,
) {
  if (!file) {
    throw new AppError(400, "BAD_REQUEST", "Attach the file to submit");
  }
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(file.mimetype) && !["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new AppError(400, "INVALID_FILE", "Only PDF, Word, or image files are accepted");
  }

  const path = advisorySubmissionObjectPath(moduleId, file.originalname);
  const fileUrl = await uploadFile(file.buffer, path, file.mimetype);

  return saveStudentSubmission(ctx, moduleId, {
    submissionKind: input.kind,
    fileUrl,
    fileName: file.originalname.slice(0, 200),
    fileMimeType: file.mimetype,
    fileSize: file.size,
    remarks: input.remarks ?? null,
  });
}
