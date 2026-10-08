import { prisma } from "../../lib/prisma.js";
import { assertOwnFolder } from "../../modules/anecdotal/anecdotal.repository.js";
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

export async function listMine(ownerId: string) {
  const records = await prisma.anecdotalRecord.findMany({
    where: { observerId: ownerId },
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
      roster: {
        select: {
          id: true,
          lrn: true,
          fullName: true,
          section: { select: { name: true } },
        },
      },
      section: { select: { name: true } },
      folder: { select: { id: true, name: true } },
    },
  });
  return records.map((r) => ({
    id: r.id,
    observationDatetime: r.observationDatetime,
    category: r.category,
    confidentialityLevel: r.confidentialityLevel,
    incident: r.descriptionOfIncident,
    studentId: r.student?.userId ?? (r.roster ? `roster:${r.roster.id}` : ""),
    studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? r.section.name,
    folderId: r.folderId,
    folderName: r.folder?.name ?? null,
  }));
}
