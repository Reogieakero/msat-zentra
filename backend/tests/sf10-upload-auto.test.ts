import { describe, it, expect, vi, afterAll } from "vitest";

vi.mock("../src/lib/storage.js", () => ({
  uploadFile: async (_buffer: unknown, path: string) => `https://storage.test/${path}`,
  sf10ObjectPath: (studentId: string, ext: string) => `sf10/${studentId}-test.${ext}`,
  getSf10Bucket: () => "test-bucket",
}));

import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma.js";
import { uploadAuto } from "../src/services/sf10/records.service.js";
import { getRecordDetail } from "../src/services/sf10/records.service.js";
import { AppError } from "../src/lib/errors.js";

function novelLrn(): string {
  return `19${String(Date.now()).slice(-10).padStart(10, "0")}`;
}

async function staffCtx() {
  const keeper =
    (await prisma.user.findFirst({ where: { role: "record_keeper" }, select: { id: true } })) ??
    (await prisma.user.findFirst({ select: { id: true } }));
  if (!keeper) throw new Error("No users in test database");
  return { userId: keeper.id, role: "record_keeper" };
}

async function learnerFile(lrn: string, classifiedGrade: string | null = "7") {
  const Excel = (ExcelJS as unknown as { default?: typeof ExcelJS }).default ?? ExcelJS;
  const wb = new Excel.Workbook();
  const ws = wb.addWorksheet("SF10");
  ws.addRow(["LAST NAME:", "AUTOPROV", "FIRST NAME:", "TESTY"]);
  ws.addRow(["MIDDLE NAME:", "MIDDLER", "LRN:", lrn]);
  if (classifiedGrade) {
    ws.addRow(["Classified as Grade:", classifiedGrade, "Section:", "Aquamarine"]);
  }
  ws.addRow(["Mathematics", 89]);
  ws.addRow(["MAPEH", ""]);
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    originalname: "SF10_AUTO.xlsx",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

const created: { userId?: string; recordId?: string } = {};

afterAll(async () => {
  try {
    if (created.recordId) {
      await prisma.auditLog.deleteMany({ where: { sourceId: created.recordId } });
      await prisma.sf10RecordVersion.deleteMany({ where: { sf10RecordId: created.recordId } });
      await prisma.sf10Record.deleteMany({ where: { id: created.recordId } });
    }
    if (created.userId) {
      await prisma.auditLog.deleteMany({ where: { sourceId: created.userId } });
      await prisma.studentProfile.deleteMany({ where: { userId: created.userId } });
      await prisma.user.deleteMany({ where: { id: created.userId } });
    }
  } catch {
    // Best-effort cleanup only.
  }
  await prisma.$disconnect();
});

describe("SF10 upload-auto (no roster match → record created from file)", () => {
  it("reports an unreadable record grade without writing (no roster talk)", async () => {
    const ctx = await staffCtx();
    const file = await learnerFile(novelLrn(), null);
    const err = await uploadAuto(ctx, { file }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("NO_GRADE_IN_FILE");
    expect((err as AppError).message).not.toMatch(/roster/i);
  });

  it("creates the student record at the file's classified grade and stores it as attached", async () => {
    const ctx = await staffCtx();
    const lrn = novelLrn();
    const file = await learnerFile(lrn);
    const result = await uploadAuto(ctx, { file });
    expect(result.studentCreated).toBe(true);
    expect(result.gradeLevel).toBe("G7");
    expect(result.ocrStatus).toBe("ready");
    expect(result.learner.lrn).toBe(lrn);
    expect(Array.isArray(result.deficiencies)).toBe(true);

    const profile = await prisma.studentProfile.findUnique({
      where: { lrn },
      select: { userId: true, gradeLevel: true, user: { select: { fullName: true, status: true } } },
    });
    expect(profile?.gradeLevel).toBe("G7");
    expect(profile?.user.fullName).toContain("AUTOPROV");
    expect(profile?.user.status).toBe("active");
    created.userId = profile?.userId;
    created.recordId = result.id;

    const record = await prisma.sf10Record.findUnique({
      where: { id: result.id },
      select: { studentId: true, status: true, ocrExtractedData: true },
    });
    expect(record?.studentId).toBe(profile?.userId);
    expect(record?.status).toBe("attach");
    const stored = record?.ocrExtractedData as unknown as {
      subjects: Array<{ norm: string; rating: number | null; gradeLevel: string | null }>;
    } | null;
    const math = stored?.subjects.find((s) => s.norm === "mathematics");
    expect(math?.gradeLevel).toBe("G7");
    expect(math?.rating).toBe(89);
  });

  it("re-uploading the same file links the enlisted learner (idempotent)", async () => {
    const ctx = await staffCtx();
    if (!created.userId) throw new Error("Provision test must run first");
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: created.userId },
      select: { lrn: true },
    });
    const file = await learnerFile(profile?.lrn as string);
    const result = await uploadAuto(ctx, { file, gradeLevel: "G7" });
    expect(result.studentCreated).toBe(false);
    expect(result.id).toBe(created.recordId);
  });

  it("detail endpoint returns record + versions + map, 404s unknown ids", async () => {
    const ctx = await staffCtx();
    if (!created.recordId) throw new Error("Provision test must run first");
    const detail = await getRecordDetail(ctx, created.recordId);
    expect(detail.record.id).toBe(created.recordId);
    expect(Array.isArray(detail.versions)).toBe(true);
    expect(Array.isArray(detail.map.deficiencies)).toBe(true);
    expect(detail.map.learner.lrn).toBeTruthy();
    const err = await getRecordDetail(ctx, "00000000-0000-0000-0000-000000000000").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("NOT_FOUND");
  });
});
