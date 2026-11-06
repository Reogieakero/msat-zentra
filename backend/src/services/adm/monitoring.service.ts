import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { buildCaseTimeline } from "../../modules/referrals/timeline.js";
import { ADM_STAGE_FLOW } from "../adm.js";

/**
 * Teacher-side ADM monitoring desk.
 *
 * The advisory adviser owns module tracking for their own advisees: they paste
 * the upload (Google Drive) link for each module, mark submissions, release new
 * modules, and read the monitoring report. Access is always resolved through
 * `Section.adviserId` — the JWT role can still be `subject_teacher` for a user
 * who claimed an advisory section in settings, so the role alone is not enough.
 */

export interface AdmModuleInput {
  moduleName?: string;
  releaseDate?: string | null;
  dueDate?: string | null;
  submissionUrl?: string | null;
  studentSubmissionUrl?: string | null;
  remarks?: string | null;
  submitted?: boolean;
}

interface CaseHeader {
  profileId: string;
  referralId: string;
  stage: string;
  stageLabel: string;
  eligibilityStatus: string;
  approvedAt: string | null;
  monitoringSince: string;
  studentId: string;
  studentName: string;
  lrn: string;
  mascot: string | null;
  photoUrl: string | null;
  gradeLevel: string;
  section: string;
  referralStatus: string;
  consultReviewer: string | null;
}

const stageLabelOf = (stage: string) =>
  ADM_STAGE_FLOW.find((s) => s.stage === stage)?.label ?? stage;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** URL-safe slug of a learner's full name (mirrors `lib/slug.ts` on the web app). */
export function caseSlug(fullName: string): string {
  return fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The monitoring desk is addressed by learner name (`ma-juana-dela-cruz`), never
 * the profile UUID, so shared links stay readable. Old UUID links still resolve.
 * Names collide only inside one advisory section, so the newest case wins.
 */
async function resolveCaseId(userId: string, identifier: string): Promise<string> {
  if (UUID_RE.test(identifier)) return identifier;
  const slug = identifier.trim().toLowerCase();
  if (!slug) throw new AppError(404, "NOT_FOUND", "ADM case not found");
  const candidates = await prisma.admLearnerProfile.findMany({
    where: { student: { section: { adviserId: userId } } },
    select: {
      id: true,
      student: { select: { user: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const match = candidates.find((c) => caseSlug(c.student.user.fullName) === slug);
  if (!match) throw new AppError(404, "NOT_FOUND", "ADM case not found");
  return match.id;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

async function loadAdvisedCase(userId: string, identifier: string) {
  const profile = await prisma.admLearnerProfile.findUnique({
    where: { id: await resolveCaseId(userId, identifier) },
    select: {
      id: true,
      referralId: true,
      stage: true,
      eligibilityStatus: true,
      approvedAt: true,
      createdAt: true,
      certificationDetails: true,
      student: {
        select: {
          userId: true,
          lrn: true,
          gradeLevel: true,
          mascot: true,
          photoUrl: true,
          user: { select: { fullName: true } },
          section: {
            select: {
              id: true,
              name: true,
              adviserId: true,
            },
          },
        },
      },
      referral: {
        select: {
          status: true,
          consultReviewer: true,
          referredBy: true,
          referredByUser: { select: { fullName: true } },
        },
      },
    },
  });
  if (!profile) throw new AppError(404, "NOT_FOUND", "ADM case not found");
  const sectionId = profile.student.section?.id ?? null;
  const adviserId = profile.student.section?.adviserId ?? null;
  if (!sectionId || adviserId !== userId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You can only monitor ADM cases of your own advisees",
    );
  }
  return profile;
}

function computeProgress(
  modules: { submitted: boolean; dueDate: Date | null; submissionDate: Date | null }[]
) {
  const today = startOfToday();
  const submitted = modules.filter((m) => m.submitted);
  const overdue = modules.filter((m) => !m.submitted && m.dueDate !== null && m.dueDate < today);
  const upcoming = modules
    .filter((m) => !m.submitted && m.dueDate !== null && m.dueDate >= today)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const lastSubmittedAt = submitted.reduce<Date | null>((latest, m) => {
    if (!m.submissionDate) return latest;
    return !latest || m.submissionDate > latest ? m.submissionDate : latest;
  }, null);
  return {
    submitted: submitted.length,
    total: modules.length,
    percent: modules.length === 0 ? 0 : Math.round((submitted.length / modules.length) * 100),
    overdueCount: overdue.length,
    nextDueAt: iso(upcoming[0]?.dueDate ?? null),
    lastSubmittedAt: iso(lastSubmittedAt),
  };
}

export async function getMonitoredCase(userId: string, caseId: string) {
  const profile = await loadAdvisedCase(userId, caseId);

  const sectionId = profile.student.section?.id ?? null;
  const [modules, sectionModules, devices, meetings, forms] = await Promise.all([
    prisma.admModule.findMany({
      where: { admLearnerProfileId: profile.id },
      select: {
        id: true,
        moduleName: true,
        releaseDate: true,
        dueDate: true,
        submitted: true,
        submissionDate: true,
        submissionUrl: true,
        studentSubmissionUrl: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ releaseDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    // Section-wide ADM modules posted from the Modules desk. They are read-only
    // here — the adviser edits them (and every other learner's row) there.
    sectionId
      ? prisma.advisoryModule.findMany({
          where: { sectionId, kind: "adm" },
          select: {
            id: true,
            moduleName: true,
            moduleUrl: true,
            releaseDate: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    prisma.admDevice.findMany({
      where: { admLearnerProfileId: profile.id },
      select: {
        id: true,
        deviceType: true,
        deviceSerial: true,
        issuedDate: true,
        returnedDate: true,
        conditionNotes: true,
      },
      orderBy: { issuedDate: "desc" },
    }),
    prisma.admParentMeeting.findMany({
      where: { admLearnerProfileId: profile.id },
      select: {
        id: true,
        meetingDatetime: true,
        venue: true,
        attended: true,
        minutesOfMeeting: true,
      },
      orderBy: { meetingDatetime: "desc" },
    }),
    prisma.admForm.findMany({
      where: { admLearnerProfileId: profile.id },
      select: { id: true, formType: true, title: true, status: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  const timelines = await buildCaseTimeline([profile.referralId]);

  const sectionSubmissions = sectionModules.length
    ? await prisma.advisoryModuleSubmission.findMany({
        where: {
          moduleId: { in: sectionModules.map((m) => m.id) },
          studentId: profile.student.userId,
        },
        select: {
          moduleId: true,
          submitted: true,
          submittedAt: true,
          submissionKind: true,
          submissionUrl: true,
          fileUrl: true,
          fileName: true,
        },
      })
    : [];
  const submissionByModule = new Map(sectionSubmissions.map((s) => [s.moduleId, s]));

  // One board: the case's own modules first, then the section ADM modules.
  const boardModules = [
    ...modules.map((m) => ({
      id: m.id,
      source: "case" as const,
      moduleName: m.moduleName,
      releaseDate: m.releaseDate,
      dueDate: m.dueDate,
      submitted: m.submitted,
      submissionDate: m.submissionDate,
      submissionUrl: m.submissionUrl ?? null,
      studentSubmissionUrl: m.studentSubmissionUrl ?? null,
      submissionKind: null,
      fileUrl: null,
      fileName: null,
      remarks: m.remarks ?? null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    ...sectionModules.map((m) => {
      const sub = submissionByModule.get(m.id) ?? null;
      const kind = sub?.submissionKind ?? null;
      return {
        id: m.id,
        source: "section" as const,
        moduleName: m.moduleName,
        releaseDate: m.releaseDate,
        dueDate: m.dueDate,
        submitted: sub?.submitted ?? false,
        submissionDate: sub?.submittedAt ?? null,
        // The posted module link lives on the module; the learner's own answer
        // is either a link, an uploaded file, or a physical hand-over.
        submissionUrl: m.moduleUrl ?? null,
        studentSubmissionUrl: kind === "link" ? (sub?.submissionUrl ?? null) : null,
        submissionKind: kind,
        fileUrl: kind === "file" ? (sub?.fileUrl ?? null) : null,
        fileName: kind === "file" ? (sub?.fileName ?? null) : null,
        remarks: null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    }),
  ];
  const progress = computeProgress(boardModules);

  const header: CaseHeader = {
    profileId: profile.id,
    referralId: profile.referralId,
    stage: profile.stage,
    stageLabel: stageLabelOf(profile.stage),
    eligibilityStatus: profile.eligibilityStatus,
    approvedAt: iso(profile.approvedAt),
    monitoringSince: profile.createdAt.toISOString(),
    studentId: profile.student.userId,
    studentName: profile.student.user.fullName,
    lrn: profile.student.lrn,
    mascot: profile.student.mascot ?? null,
    photoUrl: profile.student.photoUrl ?? null,
    gradeLevel: profile.student.gradeLevel,
    section: profile.student.section?.name ?? "",
    referralStatus: profile.referral.status,
    consultReviewer: profile.referral.consultReviewer ?? null,
  };

  return {
    header,
    progress,
    modules: boardModules.map((m) => ({
      id: m.id,
      source: m.source,
      moduleName: m.moduleName,
      releaseDate: iso(m.releaseDate),
      dueDate: iso(m.dueDate),
      submitted: m.submitted,
      submissionDate: iso(m.submissionDate),
      submissionUrl: m.submissionUrl ?? null,
      studentSubmissionUrl: m.studentSubmissionUrl ?? null,
      submissionKind: m.submissionKind,
      fileUrl: m.fileUrl,
      fileName: m.fileName,
      remarks: m.remarks ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      /** Server-computed status so the report and the table agree. */
      status: m.submitted
        ? "submitted"
        : m.dueDate !== null && m.dueDate < startOfToday()
          ? "overdue"
          : "pending",
    })),
    devices: devices.map((d) => ({
      id: d.id,
      deviceType: d.deviceType,
      deviceSerial: d.deviceSerial,
      issuedDate: d.issuedDate.toISOString(),
      returnedDate: iso(d.returnedDate),
      conditionNotes: d.conditionNotes ?? null,
    })),
    meetings: meetings.map((m) => ({
      id: m.id,
      meetingDatetime: m.meetingDatetime.toISOString(),
      venue: m.venue,
      attended: m.attended,
      minutesOfMeeting: m.minutesOfMeeting ?? null,
    })),
    forms: forms.map((f) => ({
      id: f.id,
      formType: f.formType,
      title: f.title,
      status: f.status,
      uploadedAt: iso(f.uploadedAt),
    })),
    timeline: timelines.get(profile.referralId) ?? [],
  };
}

export async function updateModule(
  userId: string,
  caseId: string,
  moduleId: string,
  input: AdmModuleInput
) {
  const profile = await loadAdvisedCase(userId, caseId);
  const module = await prisma.admModule.findFirst({
    where: { id: moduleId, admLearnerProfileId: profile.id },
    select: {
      id: true,
      moduleName: true,
      releaseDate: true,
      dueDate: true,
      submitted: true,
      submissionDate: true,
      submissionUrl: true,
      studentSubmissionUrl: true,
      remarks: true,
    },
  });
  if (!module) throw new AppError(404, "NOT_FOUND", "Module not found on this case");

  const urlTouched = input.submissionUrl !== undefined;
  const nextUrl =
    input.submissionUrl === undefined
      ? module.submissionUrl
      : input.submissionUrl?.trim()
        ? input.submissionUrl.trim()
        : null;

  const studentUrlTouched = input.studentSubmissionUrl !== undefined;
  const nextStudentUrl =
    input.studentSubmissionUrl === undefined
      ? module.studentSubmissionUrl
      : input.studentSubmissionUrl?.trim()
        ? input.studentSubmissionUrl.trim()
        : null;

  // The student's submission is its own signal: pasting the answered-module
  // link records it, clearing that link (with nothing else set) undoes it.
  const nextSubmitted = studentUrlTouched
    ? nextStudentUrl !== null || input.submitted === true
    : input.submitted !== undefined
      ? input.submitted
      : module.submitted;
  const nextSubmissionDate = nextSubmitted
    ? (module.submissionDate ?? new Date())
    : null;

  const updated = await prisma.admModule.update({
    where: { id: module.id },
    data: {
      ...(input.moduleName !== undefined ? { moduleName: input.moduleName.trim() } : {}),
      ...(input.releaseDate !== undefined
        ? { releaseDate: input.releaseDate ? new Date(input.releaseDate) : null }
        : {}),
      // Posting the link is what releases the module; the date is automatic.
      ...(input.releaseDate === undefined && nextUrl !== null && !module.releaseDate
        ? { releaseDate: new Date() }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(urlTouched ? { submissionUrl: nextUrl } : {}),
      ...(studentUrlTouched ? { studentSubmissionUrl: nextStudentUrl } : {}),
      ...(input.remarks !== undefined
        ? { remarks: input.remarks?.trim() ? input.remarks.trim() : null }
        : {}),
      submitted: nextSubmitted,
      submissionDate: nextSubmissionDate,
    },
  });

  const changedSubmission =
    studentUrlTouched || input.submitted !== undefined
      ? nextSubmitted !== module.submitted
      : false;
  await writeAudit({
    userId,
    actionType: "adm_edit",
    sourceTable: "adm_modules",
    sourceId: module.id,
    reason: urlTouched
      ? nextUrl
        ? "Module upload link saved"
        : "Module upload link cleared"
      : changedSubmission
        ? nextSubmitted
          ? "Module marked submitted"
          : "Module marked not submitted"
        : "Module details updated",
    oldValue: {
      moduleName: module.moduleName,
      submitted: module.submitted,
      submissionUrl: module.submissionUrl,
    },
    newValue: {
      moduleName: updated.moduleName,
      submitted: updated.submitted,
      submissionUrl: updated.submissionUrl,
    },
  });

  return updated;
}
