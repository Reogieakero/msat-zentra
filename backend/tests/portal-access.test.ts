import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  link: vi.fn(), links: vi.fn(), profile: vi.fn(), attendance: vi.fn(), roster: vi.fn(),
  term: vi.fn(), gradesByTerm: vi.fn(), attendanceByTerm: vi.fn(), terms: vi.fn(),
}));
vi.mock("../src/lib/prisma.js", () => ({ prisma: {
  parentStudentLink: { findUnique: mocks.link, findMany: mocks.links },
  studentProfile: { findUnique: mocks.profile },
  attendanceRecord: { findFirst: mocks.attendance, groupBy: mocks.attendanceByTerm },
  studentRoster: { findFirst: mocks.roster },
  finalGrade: { groupBy: mocks.gradesByTerm },
  term: { findUnique: mocks.term, findMany: mocks.terms },
} }));

import {
  assertLearnerAccess, learnerSectionForTerm, listLinkedChildren, resolvePortalTerm,
  type PortalTerm,
} from "../src/lib/portalAccess.js";

const term: PortalTerm = {
  id: "historical", schoolYearId: "old-year", schoolYearName: "Old year", termNumber: 1,
  startDate: null, endDate: null,
};

beforeEach(() => vi.resetAllMocks());

describe("portal ownership boundary", () => {
  it("lets a student access only their own record", async () => {
    await expect(assertLearnerAccess({ id: "self", role: "student" }, "self")).resolves.toBeUndefined();
    await expect(assertLearnerAccess({ id: "self", role: "student" }, "other"))
      .rejects.toMatchObject({ status: 403 });
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it.each([null, { approvedBy: null }])("rejects absent or unapproved parent links: %j", async (link) => {
    mocks.link.mockResolvedValue(link);
    await expect(assertLearnerAccess({ id: "parent", role: "parent" }, "child"))
      .rejects.toMatchObject({ status: 403 });
    expect(mocks.link).toHaveBeenCalledWith(expect.objectContaining({
      where: { parentId_studentId: { parentId: "parent", studentId: "child" } },
    }));
  });

  it("permits a school-approved parent link", async () => {
    mocks.link.mockResolvedValue({ approvedBy: "registrar" });
    await expect(assertLearnerAccess({ id: "parent", role: "parent" }, "child")).resolves.toBeUndefined();
  });

  it("never lists unapproved links as children", async () => {
    mocks.links.mockResolvedValue([]);
    expect(await listLinkedChildren("parent")).toEqual([]);
    expect(mocks.links).toHaveBeenCalledWith(expect.objectContaining({
      where: { parentId: "parent", approvedBy: { not: null } },
    }));
  });

  it("does not grant staff portal ownership", async () => {
    await expect(assertLearnerAccess({ id: "staff", role: "principal" }, "child"))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe("historical portal scope", () => {
  it("prefers explicit historical terms over the active fallback", async () => {
    mocks.term.mockResolvedValue({ id: "historical", termNumber: 1, startDate: null, endDate: null,
      schoolYear: { id: "old-year", name: "Old year" } });
    expect(await resolvePortalTerm("historical", "active")).toEqual(term);
    expect(mocks.term).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "historical" } }));
  });

  it("rejects nonexistent terms", async () => {
    mocks.term.mockResolvedValue(null);
    await expect(resolvePortalTerm("missing", "active")).rejects.toMatchObject({ status: 404 });
  });

  it("uses the attendance section recorded in the requested term", async () => {
    mocks.attendance.mockResolvedValue({ sectionId: "old-section" });
    expect(await learnerSectionForTerm("child", term)).toBe("old-section");
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("does not show the current section for an unrelated school year", async () => {
    mocks.attendance.mockResolvedValue(null);
    mocks.profile.mockResolvedValue({ lrn: "123", sectionId: "current-section", section: { schoolYearId: "new-year" } });
    mocks.roster.mockResolvedValue(null);
    expect(await learnerSectionForTerm("child", term)).toBeNull();
  });
});
