import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import argon2 from "argon2";
import { SY_NAME, SY_START, SY_END, TERMS, STAFF_PASSWORD, DRY } from "../config.js";

export interface CoreCtx {
  syId: string;
  termIds: { n: number; id: string; start: Date; end: Date }[];
  t1Id: string;
  t2Id: string;
  staff: Record<string, string>; // role key -> userId
  principalId: string;
}

const CORE_STAFF: { email: string; fullName: string; role: any; key: string; employeeId?: string }[] = [
  { email: "principal@zentra.test", fullName: "Default Principal", role: "principal", key: "principal" },
  { email: "registrar@zentra.test", fullName: "Default Registrar", role: "registrar", key: "registrar", employeeId: "REG01" },
  { email: "record_keeper@zentra.test", fullName: "Default Record Keeper", role: "record_keeper", key: "record_keeper", employeeId: "RK01" },
  { email: "nurse@zentra.test", fullName: "Default Nurse", role: "nurse", key: "nurse", employeeId: "NUR01" },
  { email: "nurse2@zentra.test", fullName: "Second Nurse", role: "nurse", key: "nurse2", employeeId: "NUR02" },
  { email: "guidance@zentra.test", fullName: "Default Guidance Counselor", role: "guidance_counselor", key: "guidance", employeeId: "GC01" },
  { email: "guidance2@zentra.test", fullName: "Second Guidance Counselor", role: "guidance_counselor", key: "guidance2", employeeId: "GC02" },
  { email: "adm@zentra.test", fullName: "Default ADM Coordinator", role: "adm_coordinator", key: "adm", employeeId: "ADM01" },
  { email: "adm2@zentra.test", fullName: "Second ADM Coordinator", role: "adm_coordinator", key: "adm2", employeeId: "ADM02" },
];

export async function seedCore(prisma: PrismaClient): Promise<CoreCtx> {
  const staffHash = DRY ? "dry" : await argon2.hash(STAFF_PASSWORD);
  const staff: Record<string, string> = {};

  if (!DRY) {
    for (const a of CORE_STAFF) {
      const u = await prisma.user.upsert({
        where: { email: a.email },
        update: { fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" },
        create: { email: a.email, fullName: a.fullName, role: a.role, passwordHash: staffHash, status: "active" },
      });
      staff[a.key] = u.id;
      if (a.employeeId) {
        await prisma.staffProfile.upsert({
          where: { userId: u.id },
          update: { employeeId: a.employeeId },
          create: { userId: u.id, employeeId: a.employeeId, isAdviser: false, department: a.role === "principal" ? "Administration" : "Support" },
        });
      }
    }
  } else {
    for (const a of CORE_STAFF) {
      const u = await prisma.user.findFirst({ where: { email: a.email }, select: { id: true } });
      if (u) staff[a.key] = u.id;
    }
  }

  const principalId = staff["principal"] ?? (await prisma.user.findFirst({ where: { role: "principal" }, select: { id: true } }))?.id ?? "system";

  let sy = await prisma.schoolYear.findFirst({ where: { name: SY_NAME } });
  if (!sy && !DRY) {
    await prisma.schoolYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
    sy = await prisma.schoolYear.create({
      data: { name: SY_NAME, startDate: SY_START, endDate: SY_END, isActive: true, createdBy: principalId },
    });
  }
  if (!sy) throw new Error("SchoolYear missing (dry-run without SY)");
  if (!DRY) {
    await prisma.schoolYear.update({ where: { id: sy.id }, data: { startDate: SY_START, endDate: SY_END, isActive: true } });
    await prisma.schoolYear.updateMany({ where: { id: { not: sy.id }, isActive: true }, data: { isActive: false } });
    for (const t of TERMS) {
      await prisma.term.upsert({
        where: { schoolYearId_termNumber: { schoolYearId: sy.id, termNumber: t.n } },
        update: { startDate: t.start, endDate: t.end },
        create: { schoolYearId: sy.id, termNumber: t.n, startDate: t.start, endDate: t.end },
      });
    }
  }

  const terms = await prisma.term.findMany({ where: { schoolYearId: sy.id }, orderBy: { termNumber: "asc" } });
  const termIds = terms.map((t) => ({ n: t.termNumber, id: t.id, start: t.startDate ?? SY_START, end: t.endDate ?? SY_END }));
  const t1Id = termIds.find((t) => t.n === 1)?.id;
  const t2Id = termIds.find((t) => t.n === 2)?.id;
  if (!t1Id || !t2Id) throw new Error("T1/T2 missing");

  console.log(`Core: SY=${sy.id} T1=${t1Id} T2=${t2Id} staff=${Object.keys(staff).length}`);
  return { syId: sy.id, termIds, t1Id, t2Id, staff, principalId };
}
