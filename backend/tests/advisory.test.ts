import { describe, it, expect } from "vitest";
import { requireAdvisorySections } from "../src/modules/teacher/advisory.routes.js";
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
