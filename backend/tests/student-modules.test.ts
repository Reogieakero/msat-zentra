import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  studentFindUnique: vi.fn(),
  moduleFindMany: vi.fn(),
  moduleFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  audit: vi.fn(),
  invalidate: vi.fn(),
  upload: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    studentProfile: { findUnique: mocks.studentFindUnique },
    advisoryModule: { findMany: mocks.moduleFindMany, findFirst: mocks.moduleFindFirst },
    advisoryModuleSubmission: {
      findMany: mocks.submissionFindMany,
      findFirst: mocks.submissionFindFirst,
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
  },
}));

vi.mock("../src/lib/audit.js", () => ({ writeAudit: mocks.audit }));
vi.mock("../src/lib/cache.js", () => ({ invalidateTags: mocks.invalidate }));
vi.mock("../src/lib/notify.js", () => ({ fanoutNotification: mocks.notify }));
vi.mock("../src/lib/storage.js", () => ({
  uploadFile: mocks.upload,
  advisorySubmissionObjectPath: (moduleId: string, name: string) => `modules/${moduleId}/${name}`,
}));

import {
  listStudentModules,
  submitStudentLink,
  uploadStudentSubmission,
} from "../src/services/student/modules.service.js";
import { AppError } from "../src/lib/errors.js";

const STUDENT = {
  userId: "student-1",
  lrn: "123456789012",
  sectionId: "sec-1",
  user: { fullName: "Juan Dela Cruz" },
  section: { id: "sec-1", name: "G7-A", gradeLevel: "G7", adviserId: "adviser-1" },
};

const ADM_MODULE = {
  id: "mod-1",
  sectionId: "sec-1",
  kind: "adm" as const,
  moduleName: "Module 1",
  moduleUrl: "https://drive.example/1",
  description: null,
  releaseDate: new Date("2026-10-01T00:00:00Z"),
  dueDate: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.studentFindUnique.mockResolvedValue(STUDENT);
  mocks.moduleFindMany.mockResolvedValue([]);
  mocks.submissionFindMany.mockResolvedValue([]);
  mocks.upload.mockResolvedValue("https://cdn.example/proof.pdf");
  mocks.submissionCreate.mockImplementation(async ({ data }) => ({
    id: "sub-1",
    ...data,
  }));
});

describe("student module list", () => {
  it("404s when the account has no learner profile", async () => {
    mocks.studentFindUnique.mockResolvedValue(null);
    await expect(listStudentModules({ userId: "x" }, { page: 1, pageSize: 15 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns the learner's own submission state", async () => {
    mocks.moduleFindMany.mockResolvedValue([ADM_MODULE]);
    mocks.submissionFindMany.mockResolvedValue([
      {
        moduleId: "mod-1",
        studentId: "student-1",
        submissionKind: "link",
        submissionUrl: "https://drive.example/answer",
        fileUrl: null,
        fileName: null,
        submitted: true,
        submittedAt: new Date("2026-10-02T00:00:00Z"),
        remarks: null,
      },
    ]);

    const res = await listStudentModules({ userId: "student-1" }, { page: 1, pageSize: 15 });

    expect(res.section).toMatchObject({ id: "sec-1", name: "G7-A" });
    expect(res.data[0]).toMatchObject({ id: "mod-1", submitted: true, status: "submitted" });
    expect(res.counts).toMatchObject({ all: 1, submitted: 1 });
  });

  it("marks an unsubmitted module overdue after its due date", async () => {
    mocks.moduleFindMany.mockResolvedValue([
      { ...ADM_MODULE, dueDate: new Date("2026-01-01T00:00:00Z") },
    ]);
    const res = await listStudentModules({ userId: "student-1" }, { page: 1, pageSize: 15 });
    expect(res.data[0]?.status).toBe("overdue");
  });
});

describe("student submission", () => {
  it("rejects a module outside the learner's section", async () => {
    mocks.moduleFindFirst.mockResolvedValue(null);
    await expect(
      submitStudentLink({ userId: "student-1" }, "mod-other", {
        submissionUrl: "https://drive.example/x",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects post-only general modules", async () => {
    mocks.moduleFindFirst.mockResolvedValue({ ...ADM_MODULE, kind: "general" });
    await expect(
      submitStudentLink({ userId: "student-1" }, "mod-1", {
        submissionUrl: "https://drive.example/x",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("records a link submission as the learner and notifies the adviser", async () => {
    mocks.moduleFindFirst.mockResolvedValue(ADM_MODULE);
    mocks.submissionFindFirst.mockResolvedValue(null);

    const id = await submitStudentLink({ userId: "student-1" }, "mod-1", {
      submissionUrl: "https://drive.example/answer",
    });

    expect(id).toBe("sub-1");
    const created = mocks.submissionCreate.mock.calls[0]?.[0].data;
    expect(created).toMatchObject({
      moduleId: "mod-1",
      studentId: "student-1",
      rosterId: null,
      submissionKind: "link",
      submissionUrl: "https://drive.example/answer",
      submitted: true,
      recordedBy: "student-1",
    });
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "adviser-1", action: "submit" }),
    );
  });

  it("stores an uploaded proof for a physical hand-in", async () => {
    mocks.moduleFindFirst.mockResolvedValue(ADM_MODULE);
    mocks.submissionFindFirst.mockResolvedValue(null);

    await uploadStudentSubmission(
      { userId: "student-1" },
      "mod-1",
      { kind: "physical", remarks: null },
      {
        buffer: Buffer.from("proof"),
        originalname: "proof.jpg",
        mimetype: "image/jpeg",
        size: 5,
      },
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      "modules/mod-1/proof.jpg",
      "image/jpeg",
    );
    const created = mocks.submissionCreate.mock.calls[0]?.[0].data;
    expect(created).toMatchObject({
      submissionKind: "physical",
      fileUrl: "https://cdn.example/proof.pdf",
      fileName: "proof.jpg",
      recordedBy: "student-1",
    });
  });
});
