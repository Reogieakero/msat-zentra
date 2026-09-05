import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import {
  buildOcForm01Buffer,
  ocForm01Filename,
  parseSignatureDataUrl,
  type OcForm01Data,
} from "./ocform01.service.js";

const router = Router();

const createSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  observationDatetime: z.string().datetime(),
  descriptionOfIncident: z.string().min(1),
  descriptionOfLocation: z.string().optional(),
  notesRecommendationsActions: z.string().optional(),
  classPerformance: z.string().optional(),
  attendanceSummary: z.string().optional(),
  category: z.enum(["behavioral", "bullying", "academic", "attendance", "health"]).default("behavioral"),
  confidentialityLevel: z.enum(["restricted", "confidential"]).default("restricted"),
  folderId: z.string().min(1).optional(),
});
router.post(
  "/",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", createSchema),
  async (req, res, next) => {
    try {
      // A filing can land straight into one of the teacher's own folders.
      if (req.body.folderId) {
        const folder = await prisma.anecdotalFolder.findUnique({
          where: { id: req.body.folderId },
          select: { ownerId: true },
        });
        if (!folder || folder.ownerId !== req.user!.id) {
          throw new AppError(404, "FOLDER_NOT_FOUND", "Folder not found");
        }
      }
      const record = await prisma.anecdotalRecord.create({
        data: { ...req.body, observationDatetime: new Date(req.body.observationDatetime), observerId: req.user!.id },
      });
      await writeAudit({ userId: req.user!.id, actionType: "anecdotal_edit", sourceTable: "anecdotal_records", sourceId: record.id, reason: "Anecdotal record created" });
      res.status(201).json(record);
    } catch (e) { next(e); }
  }
);

const followupSchema = z.object({ notes: z.string().min(1) });
router.post(
  "/:id/followups",
  requireAuth,
  requireRole("adviser", "guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", followupSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const followup = await prisma.anecdotalRecordFollowup.create({
        data: { anecdotalRecordId: record.id, followupBy: req.user!.id, followupDate: new Date(), notes: req.body.notes },
      });
      await fanoutNotification({
        userId: record.observerId, sourceTable: "anecdotal_record_followups", action: "create",
        message: "New follow-up added to an anecdotal record.", sourceId: followup.id,
      });
      res.status(201).json(followup);
    } catch (e) { next(e); }
  }
);

const referSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
  reason: z.string().min(1),
  termId: z.string().min(1),
});
router.post(
  "/:id/refer",
  requireAuth,
  requireRole("adviser"),
  validate("body", referSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const referral = await prisma.referral.create({
        data: { anecdotalRecordId: record.id, referredToRole: req.body.referredToRole, referredBy: req.user!.id, reason: req.body.reason, studentId: record.studentId, termId: req.body.termId },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Referred to ${req.body.referredToRole}` });
      res.status(201).json(referral);
    }   catch (e) { next(e); }
  }
);

const CATEGORY_KEYS = ["behavioral", "bullying", "academic", "attendance", "health"] as const;
const CATEGORY_META: Record<
  string,
  { label: string; color: string }
> = {
  behavioral: { label: "Behavioral", color: "#166534" },
  bullying: { label: "Bullying", color: "#b91c1c" },
  academic: { label: "Academic", color: "#1d4ed8" },
  attendance: { label: "Attendance", color: "#c2410c" },
  health: { label: "Health", color: "#7c3aed" },
};

// Principal: records heatmap source — every section with its students that have
// anecdotal records, including each record's category/severity/follow-up. The
// categories returned here are the canonical backend AnecdotalCategory enum, so
// the heatmap legend and block colors stay wired to the backend.
router.get(
  "/records",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, schoolYearId: true },
      });
      const termId = activeTerm?.id;
      const schoolYear = activeTerm
        ? ((await prisma.schoolYear.findUnique({
            where: { id: activeTerm.schoolYearId },
            select: { name: true },
          }))?.name ?? "")
        : "";
      const where = termId ? { termId } : {};

      const [sections, records, followups, referrals] = await Promise.all([
        prisma.section.findMany({
          where: termId ? { schoolYearId: activeTerm!.schoolYearId } : {},
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
        prisma.anecdotalRecord.findMany({
          where,
          select: {
            id: true,
            studentId: true,
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

      const recordByStudent = new Map<string, typeof records>();
      for (const r of records) {
        const arr = recordByStudent.get(r.studentId) ?? [];
        arr.push(r);
        recordByStudent.set(r.studentId, arr);
      }

      const dataSections = sections
        .map((section) => {
          const students = section.students
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
                behavioral: recs.map((r) => {
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
                }),
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);
          if (students.length === 0) return null;
          return {
            sectionId: section.id,
            section: section.name,
            gradeLevel: section.gradeLevel,
            students,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      res.json({
        schoolYear,
        sections: dataSections,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/summary",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true },
      });
      const termId = activeTerm?.id;
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
        lrn: r.student.lrn,
        section: r.student.section?.name ?? "",
        year: GRADE_LABEL[r.student.gradeLevel] ?? r.student.gradeLevel,
        dateAdded: r.observationDatetime.toISOString().slice(0, 10),
        adviser: r.observer.fullName,
      }));

      res.json({ categories, total, students });
    } catch (e) {
      next(e);
    }
  }
);

const FILER_ROLES = ["adviser", "subject_teacher"] as const;

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Folder name is required")
  .max(60, "Folder name must be 60 characters or fewer");

async function assertOwnFolder(folderId: string, ownerId: string) {
  const folder = await prisma.anecdotalFolder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true },
  });
  if (!folder || folder.ownerId !== ownerId) {
    throw new AppError(404, "FOLDER_NOT_FOUND", "Folder not found");
  }
  return folder;
}

// Teacher-owned record folders. Every route is owner-scoped: teachers only
// ever see and touch their own folders.
router.get(
  "/folders",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      const folders = await prisma.anecdotalFolder.findMany({
        where: { ownerId: req.user!.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { records: true } },
        },
      });
      res.json(
        folders.map((f) => ({
          id: f.id,
          name: f.name,
          createdAt: f.createdAt,
          recordCount: f._count.records,
        }))
      );
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/folders",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", z.object({ name: folderNameSchema })),
  async (req, res, next) => {
    try {
      const folder = await prisma.anecdotalFolder.create({
        data: { ownerId: req.user!.id, name: req.body.name },
        select: { id: true, name: true, createdAt: true },
      });
      res.status(201).json({ ...folder, recordCount: 0 });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/folders/:id",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", z.object({ name: folderNameSchema })),
  async (req, res, next) => {
    try {
      await assertOwnFolder(String(req.params.id), req.user!.id);
      const folder = await prisma.anecdotalFolder.update({
        where: { id: String(req.params.id) },
        data: { name: req.body.name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { records: true } },
        },
      });
      res.json({
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt,
        recordCount: folder._count.records,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/folders/:id",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      await assertOwnFolder(String(req.params.id), req.user!.id);
      // Records survive: the FK is ON DELETE SET NULL, so they become ungrouped.
      await prisma.anecdotalFolder.delete({ where: { id: String(req.params.id) } });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

// The teacher's own filed records (any term) — backs the folder pages and
// the filing chat's folder picker. Own rows only, so no advisee gate needed.
router.get(
  "/mine",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      const records = await prisma.anecdotalRecord.findMany({
        where: { observerId: req.user!.id },
        orderBy: { observationDatetime: "desc" },
        select: {
          id: true,
          observationDatetime: true,
          category: true,
          confidentialityLevel: true,
          descriptionOfIncident: true,
          folderId: true,
          student: {
            select: {
              userId: true,
              lrn: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          section: { select: { name: true } },
          folder: { select: { id: true, name: true } },
        },
      });
      res.json(
        records.map((r) => ({
          id: r.id,
          observationDatetime: r.observationDatetime,
          category: r.category,
          confidentialityLevel: r.confidentialityLevel,
          incident: r.descriptionOfIncident,
          studentId: r.student.userId,
          studentName: r.student.user.fullName,
          lrn: r.student.lrn,
          section: r.student.section?.name ?? r.section.name,
          folderId: r.folderId,
          folderName: r.folder?.name ?? null,
        }))
      );
    } catch (e) {
      next(e);
    }
  }
);

// File one of your records into (or out of) your folders. Allowed for the
// observer and the section adviser (the form's signatory).
router.patch(
  "/:id/folder",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", z.object({ folderId: z.string().min(1).nullable() })),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({
        where: { id: String(req.params.id) },
        select: {
          id: true,
          observerId: true,
          section: { select: { adviserId: true } },
        },
      });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const allowed =
        record.observerId === req.user!.id ||
        record.section.adviserId === req.user!.id;
      if (!allowed) {
        throw new AppError(403, "FORBIDDEN", "Only the observer or section adviser may file this record");
      }
      const folderId: string | null = req.body.folderId;
      if (folderId) await assertOwnFolder(folderId, req.user!.id);
      const updated = await prisma.anecdotalRecord.update({
        where: { id: record.id },
        data: { folderId },
        select: { id: true, folderId: true },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

const OCFORM01_ROLES = [
  "adviser",
  "subject_teacher",
  "guidance_counselor",
  "principal",
  "nurse",
  "adm_coordinator",
] as const;

const GRADE_LABEL_OC: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

// Full write-up access for the official OCForm-01 print/export. The observer
// always qualifies; the section adviser qualifies as the required signatory
// ("ADVISER'S SIGNATURE OVER PRINTED NAME"); principal + guidance own the
// case file. Anyone else (e.g. a non-observing subject teacher) gets 403 —
// mirroring the metadata-only rule on the advisory anecdotal list.
async function loadOcForm01Data(recordId: string, requesterId: string, requesterRole: string): Promise<{
  data: OcForm01Data;
  filename: string;
  recordId: string;
  canSign: boolean;
  signature: { by: string; at: string; imageUrl: string } | null;
}> {
  const record = await prisma.anecdotalRecord.findUnique({
    where: { id: recordId },
    include: {
      observer: { select: { fullName: true } },
      student: {
        select: {
          gradeLevel: true,
          user: { select: { fullName: true } },
        },
      },
      section: {
        select: {
          name: true,
          adviserId: true,
          adviser: { select: { fullName: true } },
        },
      },
    },
  });
  if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");

  const isObserver = record.observerId === requesterId;
  const isSectionAdviser = record.section.adviserId === requesterId;
  const isCaseOwner =
    requesterRole === "principal" || requesterRole === "guidance_counselor";
  if (!isObserver && !isSectionAdviser && !isCaseOwner) {
    throw new AppError(403, "FORBIDDEN", "Only the observer, section adviser, principal, or guidance counselor may open the official form");
  }

  const gradeLabel = GRADE_LABEL_OC[record.student.gradeLevel] ?? record.student.gradeLevel;
  const gradeSection = `${gradeLabel} - ${record.section.name}`;
  const when = record.observationDatetime;

  let signature: { by: string; at: string; imageUrl: string } | null = null;
  let signatureImage: Uint8Array | undefined;
  if (record.signedBy && record.signedAt && record.signatureImageUrl) {
    const signer = await prisma.user.findUnique({
      where: { id: record.signedBy },
      select: { fullName: true },
    });
    signature = {
      by: signer?.fullName ?? "Adviser",
      at: record.signedAt.toISOString(),
      imageUrl: record.signatureImageUrl,
    };
    signatureImage = await loadSignatureBytes(record.signatureImageUrl);
  }

  const data: OcForm01Data = {
    observerName: record.observer.fullName,
    gradeSection,
    observationDate: when.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }),
    observationTime: when.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }),
    studentName: record.student.user.fullName,
    descriptionOfIncident: record.descriptionOfIncident,
    descriptionOfLocation: record.descriptionOfLocation ?? "",
    notesRecommendationsActions: record.notesRecommendationsActions ?? "",
    classPerformance: record.classPerformance ?? "",
    attendanceSummary: record.attendanceSummary ?? "",
    adviserName: record.section.adviser?.fullName ?? record.observer.fullName,
    signatureImage,
  };
  // Only the signatory may (re)sign: the section adviser, or the observer
  // when no adviser is assigned.
  const canSign =
    isSectionAdviser || (!record.section.adviserId && isObserver);
  return {
    data,
    filename: ocForm01Filename(data.studentName, when),
    recordId: record.id,
    canSign,
    signature,
  };
}

/** Fetch stored signature bytes for .xlsx embedding; undefined on any failure. */
async function loadSignatureBytes(imageUrl: string): Promise<Uint8Array | undefined> {
  try {
    if (imageUrl.startsWith("data:")) {
      return parseSignatureDataUrl(imageUrl);
    }
    const res = await fetch(imageUrl);
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 2_000_000) return undefined;
    return buffer;
  } catch {
    return undefined;
  }
}

// JSON payload backing the frontend printable OCForm-01 sheet.
router.get(
  "/:id/detail",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const { data, canSign, signature } = await loadOcForm01Data(
        String(req.params.id),
        req.user!.id,
        req.user!.role
      );
      const { signatureImage: _omitted, ...sheet } = data;
      res.json({ ...sheet, canSign, signature });
    } catch (e) {
      next(e);
    }
  }
);

// Official .xlsx export byte-matching the OCForm-01 template layout.
router.get(
  "/:id/export",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const { data, filename, recordId } = await loadOcForm01Data(
        String(req.params.id),
        req.user!.id,
        req.user!.role
      );
      const buffer = await buildOcForm01Buffer(data);
      await writeAudit({
        userId: req.user!.id,
        actionType: "anecdotal_edit",
        sourceTable: "anecdotal_records",
        sourceId: recordId,
        reason: "OCForm-01 exported",
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", String(buffer.length));
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }
);

const signSchema = z.object({ signatureImage: z.string().min(1) });

// The teacher's one reusable drawn signature (GET/PUT /signature), stamped
// onto records via POST /:id/apply-signature. Stored as a PNG data URL on
// the staff profile — no storage bucket needed.
router.get(
  "/signature",
  requireAuth,
  requireRole(...FILER_ROLES),
  async (req, res, next) => {
    try {
      const profile = await prisma.staffProfile.findUnique({
        where: { userId: req.user!.id },
        select: { signatureImageUrl: true },
      });
      res.json({ imageUrl: profile?.signatureImageUrl ?? null });
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/signature",
  requireAuth,
  requireRole(...FILER_ROLES),
  validate("body", signSchema),
  async (req, res, next) => {
    try {
      let image: Buffer;
      try {
        image = parseSignatureDataUrl(req.body.signatureImage);
      } catch (e) {
        throw new AppError(400, "BAD_SIGNATURE", (e as Error).message);
      }
      const imageUrl = `data:image/png;base64,${image.toString("base64")}`;
      const profile = await prisma.staffProfile.upsert({
        where: { userId: req.user!.id },
        update: { signatureImageUrl: imageUrl },
        create: {
          userId: req.user!.id,
          employeeId: `T-${req.user!.id.slice(0, 8)}`,
          signatureImageUrl: imageUrl,
        },
        select: { signatureImageUrl: true },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "anecdotal_edit",
        sourceTable: "staff_profiles",
        sourceId: req.user!.id,
        reason: "Teacher signature saved",
      });
      res.json({ imageUrl: profile.signatureImageUrl });
    } catch (e) {
      next(e);
    }
  }
);

// Stamp the teacher's saved signature onto one record (same signatory rule
// as drawing directly). 409 when the teacher hasn't saved one yet.
router.post(
  "/:id/apply-signature",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const [record, profile] = await Promise.all([
        prisma.anecdotalRecord.findUnique({
          where: { id: String(req.params.id) },
          select: {
            id: true,
            observerId: true,
            section: { select: { adviserId: true } },
          },
        }),
        prisma.staffProfile.findUnique({
          where: { userId: req.user!.id },
          select: { signatureImageUrl: true },
        }),
      ]);
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const maySign =
        record.section.adviserId === req.user!.id ||
        (!record.section.adviserId && record.observerId === req.user!.id);
      if (!maySign) {
        throw new AppError(403, "FORBIDDEN", "Only the section adviser may sign this form");
      }
      if (!profile?.signatureImageUrl) {
        throw new AppError(409, "NO_SIGNATURE", "Save your signature first, then apply it.");
      }
      const signed = await prisma.anecdotalRecord.update({
        where: { id: record.id },
        data: {
          signedBy: req.user!.id,
          signedAt: new Date(),
          signatureImageUrl: profile.signatureImageUrl,
        },
        select: { id: true, signedBy: true, signedAt: true, signatureImageUrl: true },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "anecdotal_edit",
        sourceTable: "anecdotal_records",
        sourceId: record.id,
        reason: "OCForm-01 signed (saved signature applied)",
      });
      res.status(201).json(signed);
    } catch (e) {
      next(e);
    }
  }
);

// Drawn-signature sign-off for one record. Only the signatory may sign: the
// section adviser, or the observer when no adviser is assigned (same rule
// that picks the printed name). Re-signing overwrites the previous mark.
router.post(
  "/:id/sign",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  validate("body", signSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({
        where: { id: String(req.params.id) },
        select: {
          id: true,
          observerId: true,
          section: { select: { adviserId: true } },
        },
      });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const maySign =
        record.section.adviserId === req.user!.id ||
        (!record.section.adviserId && record.observerId === req.user!.id);
      if (!maySign) {
        throw new AppError(403, "FORBIDDEN", "Only the section adviser may sign this form");
      }
      let image: Buffer;
      try {
        image = parseSignatureDataUrl(req.body.signatureImage);
      } catch (e) {
        throw new AppError(400, "BAD_SIGNATURE", (e as Error).message);
      }
      // No storage bucket is provisioned yet, so the PNG data URL itself is
      // stored on the row (small canvas PNGs only — capped by the parser).
      // If a bucket is added later, upload here and store the public URL;
      // readers already accept both data: and https: URLs.
      const imageUrl = `data:image/png;base64,${image.toString("base64")}`;
      const signed = await prisma.anecdotalRecord.update({
        where: { id: record.id },
        data: { signedBy: req.user!.id, signedAt: new Date(), signatureImageUrl: imageUrl },
        select: { id: true, signedBy: true, signedAt: true, signatureImageUrl: true },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "anecdotal_edit",
        sourceTable: "anecdotal_records",
        sourceId: record.id,
        reason: "OCForm-01 signed",
      });
      res.status(201).json(signed);
    } catch (e) {
      next(e);
    }
  }
);

// Remove a signature (same signatory rule). The form returns to unsigned.
router.delete(
  "/:id/sign",
  requireAuth,
  requireRole(...OCFORM01_ROLES),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({
        where: { id: String(req.params.id) },
        select: {
          id: true,
          observerId: true,
          section: { select: { adviserId: true } },
        },
      });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const maySign =
        record.section.adviserId === req.user!.id ||
        (!record.section.adviserId && record.observerId === req.user!.id);
      if (!maySign) {
        throw new AppError(403, "FORBIDDEN", "Only the section adviser may remove this signature");
      }
      await prisma.anecdotalRecord.update({
        where: { id: record.id },
        data: { signedBy: null, signedAt: null, signatureImageUrl: null },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "anecdotal_edit",
        sourceTable: "anecdotal_records",
        sourceId: record.id,
        reason: "OCForm-01 signature removed",
      });
      res.json({ id: record.id, signed: false });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
