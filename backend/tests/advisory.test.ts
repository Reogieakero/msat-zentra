import { describe, it, expect } from "vitest";
import { requireAdvisorySections } from "../src/modules/teacher/advisory.repository.js";
import { isSf10ProvisionedEmail } from "../src/services/advisory/roster.service.js";
import { AppError } from "../src/lib/errors.js";

describe("Adviser gate (Phase 1)", () => {
  it("returns the sections when the teacher advises at least one", () => {
    const sections = [{ id: "sec-G7-A", name: "G7-A", gradeLevel: "G7" as const }];
    expect(requireAdvisorySections(sections)).toEqual(sections);
  });

  it("throws 404 when the teacher advises no section", () => {
    try {
      requireAdvisorySections([]);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(404);
    }
  });
});

describe("Advisory enlist gate (SF10-provisioned LRNs)", () => {
  it("treats the SF10 placeholder email as provisioned (never gates enlist)", () => {
    expect(isSf10ProvisionedEmail("716385485599@sf10-provisioned.local")).toBe(true);
    expect(isSf10ProvisionedEmail("716385485599@SF10-PROVISIONED.LOCAL")).toBe(true);
  });

  it("treats real and ADM-provisioned accounts as registered (still gated)", () => {
    expect(isSf10ProvisionedEmail("student@zentra.test")).toBe(false);
    expect(isSf10ProvisionedEmail("716385485599@adm-provisioned.local")).toBe(false);
    expect(isSf10ProvisionedEmail("not-an-email")).toBe(false);
  });
});
