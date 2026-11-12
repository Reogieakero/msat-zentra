import { prisma } from "../../lib/prisma.js";
import { assertOwnFolder } from "../../modules/anecdotal/anecdotal.repository.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedLearnerRows,
} from "../../lib/learnerVisibility.js";
import type { AnecdotalContext } from "./anecdotal.types.js";

export async function listFolders(ownerId: string) {
  const folders = await prisma.anecdotalFolder.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { records: true } },
    },
  });
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: f.createdAt,
    recordCount: f._count.records,
  }));
}

export async function createFolder(ownerId: string, name: string) {
  const folder = await prisma.anecdotalFolder.create({
    data: { ownerId, name },
    select: { id: true, name: true, createdAt: true },
  });
  return { ...folder, recordCount: 0 };
}

export async function renameFolder(ctx: AnecdotalContext, folderId: string, name: string) {
  await assertOwnFolder(folderId, ctx.userId);
  const folder = await prisma.anecdotalFolder.update({
    where: { id: folderId },
    data: { name },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { records: true } },
    },
  });
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
    recordCount: folder._count.records,
  };
}

export async function deleteFolder(ctx: AnecdotalContext, folderId: string) {
  await assertOwnFolder(folderId, ctx.userId);

  await prisma.anecdotalFolder.delete({ where: { id: folderId } });
}

export async function listMine(
  ownerId: string,
  scope: { termId?: string | null; schoolYearId?: string | null } = {},
  opts: { deleted?: boolean } = {},
) {
  // The anecdotal desk is advisory-scoped: only records this teacher filed
  // about their own advisees surface here. A teacher with no advisory section
  // (subject teacher) keeps seeing every record they filed.
  const advised = await prisma.section.findMany({
    where: { adviserId: ownerId },
    select: { id: true },
  });
  const sectionIds = advised.map((s) => s.id);
  const archivedLearners = await archivedAdvisoryLearnerIds();
  // Classes (and the advisees) are shared by all three terms of a school year,
  // so the desk shows every record filed this school year — switching term
  // must not hide last term's records. The record's own term travels with it
  // so the UI can label where it was filed.
  const where: {
    observerId: string;
    deletedAt: null | { not: null };
    term?: { schoolYearId: string };
    termId?: string;
    OR?: object[];
    NOT?: { OR: object[] };
  } = {
    observerId: ownerId,
    // The desk shows live records; the "Deleted" view passes deleted: true to
    // list only the soft-deleted ones the teacher can restore.
    deletedAt: opts.deleted ? { not: null } : null,
    // A learner the adviser removed from the advisory list must not resurface
    // here through records they filed earlier.
    ...excludeArchivedLearnerRows(archivedLearners),
  };
  if (scope.schoolYearId) where.term = { schoolYearId: scope.schoolYearId };
  else if (scope.termId) where.termId = scope.termId;
  if (sectionIds.length > 0) {
    // Advisees are resolved through the student/roster section (or the
    // record's own section), so a learner moved into the advisory section
    // still shows their earlier records and outsiders never appear.
    where.OR = [
      { student: { sectionId: { in: sectionIds } } },
      { roster: { sectionId: { in: sectionIds } } },
      { sectionId: { in: sectionIds } },
    ];
  }

  const records = await prisma.anecdotalRecord.findMany({
    where: where as never,
    orderBy: opts.deleted ? { deletedAt: "desc" } : { observationDatetime: "desc" },
    select: {
      id: true,
      observationDatetime: true,
      deletedAt: true,
      category: true,
      confidentialityLevel: true,
      descriptionOfIncident: true,
      signedAt: true,
      folderId: true,
      student: {
        select: {
          userId: true,
          lrn: true,
          mascot: true,
          user: { select: { fullName: true } },
          section: { select: { name: true } },
        },
      },
      roster: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          mascot: true,
          section: { select: { name: true } },
        },
      },
      section: { select: { name: true } },
      term: { select: { termNumber: true } },
      folder: { select: { id: true, name: true } },
    },
  });
  // "Edited" is tracked through the audit trail: updateRecord writes an
  // anecdotal_edit row with this exact reason (delete/restore/export use
  // different reasons), so the desk can badge records that no longer match
  // the original filing without a per-record column.
  const editedIds = new Set(
    (
      await prisma.auditLog.findMany({
        where: {
          sourceTable: "anecdotal_records",
          sourceId: { in: records.map((r) => r.id) },
          actionType: "anecdotal_edit",
          reason: "Anecdotal record edited",
        },
        select: { sourceId: true },
        distinct: ["sourceId"],
      })
    ).map((a) => a.sourceId),
  );
  return records.map((r) => ({
    id: r.id,
    observationDatetime: r.observationDatetime,
    deletedAt: r.deletedAt,
    category: r.category,
    confidentialityLevel: r.confidentialityLevel,
    incident: r.descriptionOfIncident,
    termNumber: r.term.termNumber,
    studentId: r.student?.userId ?? (r.roster ? `roster:${r.roster.id}` : ""),
    studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    mascot: r.student?.mascot ?? r.roster?.mascot ?? null,
    section: r.student?.section?.name ?? r.roster?.section?.name ?? r.section.name,
    signed: r.signedAt != null,
    edited: editedIds.has(r.id),
    folderId: r.folderId,
    folderName: r.folder?.name ?? null,
  }));
}
