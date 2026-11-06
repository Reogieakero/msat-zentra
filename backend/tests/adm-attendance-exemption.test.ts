import { describe, it, expect } from "vitest";
import { isExemptCase } from "../src/services/adm/attendancePolicy.js";
import { computeRiskFactors } from "../src/services/risk.js";

const signed = { approvedBy: "principal-1", returnedAt: null, stage: "enrollment_monitoring" };

describe("ADM exemption predicate", () => {
  it("exempts a case signed by the Principal in enrollment monitoring", () => {
    expect(isExemptCase(signed)).toBe(true);
  });

  it("keeps a completed case exempt", () => {
    expect(isExemptCase({ ...signed, stage: "completion" })).toBe(true);
  });

  it("does NOT exempt an unsigned case at certification", () => {
    expect(
      isExemptCase({ approvedBy: null, returnedAt: null, stage: "certification" }),
    ).toBe(false);
  });

  it("does NOT exempt a certified case still waiting for the signature", () => {
    expect(
      isExemptCase({ approvedBy: null, returnedAt: null, stage: "principal_approval" }),
    ).toBe(false);
  });

  it("does NOT exempt a pre-certification case", () => {
    for (const stage of ["anecdotal", "consultation", "meeting_parents", "home_visitation"]) {
      expect(isExemptCase({ approvedBy: null, returnedAt: null, stage })).toBe(false);
    }
  });

  it("revokes the exemption when the Principal returns the case", () => {
    expect(
      isExemptCase({ ...signed, approvedBy: null, returnedAt: new Date(), stage: "certification" }),
    ).toBe(false);
  });
});

const attendance = [
  { status: "present", subjectId: "subj-1" },
  { status: "absent", subjectId: "subj-1" },
  { status: "absent", subjectId: "subj-1" },
  { status: "absent", subjectId: "subj-1" },
];

describe("ADM risk factor suppression", () => {
  it("suppresses the attendance flag for an exempt learner", () => {
    const flags = computeRiskFactors({
      finalGrades: [{ computedAverage: 88, transmutedGrade: 90 }],
      attendance,
      attendanceTotal: 10,
      anecdotalCount: 0,
      enrolled: 40,
      attendanceExempt: true,
    });
    expect(flags.attendanceFlag).toBe(false);
    expect(flags.academicFlag).toBe(false);
    expect(flags.behavioralFlag).toBe(false);
  });

  it("still flags a failing average for an exempt learner", () => {
    const flags = computeRiskFactors({
      finalGrades: [{ computedAverage: 60, transmutedGrade: 68 }],
      attendance,
      attendanceTotal: 10,
      anecdotalCount: 0,
      enrolled: 40,
      attendanceExempt: true,
    });
    expect(flags.academicFlag).toBe(true);
    expect(flags.attendanceFlag).toBe(false);
  });

  it("still flags a behavioral record for an exempt learner", () => {
    const flags = computeRiskFactors({
      finalGrades: [],
      attendance: [],
      anecdotalCount: 1,
      enrolled: 40,
      attendanceExempt: true,
    });
    expect(flags.behavioralFlag).toBe(true);
    expect(flags.attendanceFlag).toBe(false);
  });

  it("keeps the attendance flag for a non-exempt learner (unchanged behavior)", () => {
    const flags = computeRiskFactors({
      finalGrades: [],
      attendance,
      attendanceTotal: 10,
      anecdotalCount: 0,
      enrolled: 40,
    });
    expect(flags.attendanceFlag).toBe(true);
  });
});
