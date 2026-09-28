import { describe, it, expect } from "vitest";
import { gradeToNumber, isMasterTeacherEligible } from "../src/modules/teacher/teacher.routes.js";

describe("Master Teacher eligibility (grades 7–10)", () => {
  it("accepts grades 7–10 in enum or numeric form", () => {
    expect(isMasterTeacherEligible(["G7"])).toBe(true);
    expect(isMasterTeacherEligible(["G7", "G10"])).toBe(true);
    expect(isMasterTeacherEligible([7, 8, 9, 10])).toBe(true);
  });

  it("rejects any grade outside 7–10", () => {
    expect(isMasterTeacherEligible(["G11"])).toBe(false);
    expect(isMasterTeacherEligible(["G7", "G11"])).toBe(false);
    expect(isMasterTeacherEligible(["G12"])).toBe(false);
  });

  it("allows declaration when nothing is assigned yet", () => {
    expect(isMasterTeacherEligible([])).toBe(true);
  });

  it("parses grade numbers from enum labels", () => {
    expect(gradeToNumber("G7")).toBe(7);
    expect(gradeToNumber("G12")).toBe(12);
    expect(gradeToNumber(9)).toBe(9);
    expect(gradeToNumber("unknown")).toBe(0);
  });
});
