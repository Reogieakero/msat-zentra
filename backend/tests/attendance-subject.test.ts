import { describe, it, expect } from "vitest";
import {
  groupSubjectDay,
  subjectRate,
  dailyFromSubjects,
} from "../src/services/attendance.js";
import { computeRiskFactors } from "../src/services/risk.js";

const D = (s: string) => new Date(`${s}T00:00:00Z`);

describe("per-subject attendance engine", () => {
  describe("groupSubjectDay", () => {
    it("groups by subject+day and skips legacy rows (subjectId null)", () => {
      const grouped = groupSubjectDay([
        { subjectId: "math", date: D("2026-09-28"), status: "present" },
        { subjectId: "math", date: D("2026-09-28"), status: "absent" },
        { subjectId: "eng", date: D("2026-09-28"), status: "present" },
        { subjectId: null, date: D("2026-09-28"), status: "present" }, // legacy AM/PM
      ]);
      expect(grouped.get("math")!.get("2026-09-28")).toMatchObject({
        present: 1,
        absent: 1,
        total: 2,
      });
      expect(grouped.get("eng")!.get("2026-09-28")).toMatchObject({
        present: 1,
        total: 1,
      });
      expect(grouped.size).toBe(2); // legacy row excluded
    });
  });

  describe("subjectRate", () => {
    it("computes present ÷ subjectSessions, empty = 1", () => {
      expect(subjectRate([])).toBe(1);
      expect(
        subjectRate([
          { status: "present" },
          { status: "present" },
          { status: "absent" },
          { status: "late" },
        ])
      ).toBe(0.5);
    });
  });

  describe("dailyFromSubjects", () => {
    it("counts a day present only when every subject is present", () => {
      // Mon 2026-09-28: 5 subjects, 1 absent -> not a present day.
      // Tue 2026-09-29: all present -> present day.
      const records = [
        { date: D("2026-09-28"), status: "present" as const },
        { date: D("2026-09-28"), status: "present" as const },
        { date: D("2026-09-28"), status: "absent" as const },
        { date: D("2026-09-29"), status: "present" as const },
        { date: D("2026-09-29"), status: "present" as const },
      ];
      const { presentDays, totalDays } = dailyFromSubjects(records, 0);
      expect(totalDays).toBe(2); // two distinct days, NOT five sessions
      expect(presentDays).toBe(1);
    });

    it("treats late/excused as breaking a present day and skips weekends", () => {
      const records = [
        { date: D("2026-10-03"), status: "present" as const }, // Saturday
        { date: D("2026-10-05"), status: "late" as const }, // Monday
      ];
      const { presentDays, totalDays } = dailyFromSubjects(records, 0);
      expect(totalDays).toBe(1);
      expect(presentDays).toBe(0);
    });

    it("requires full coverage when expectedSubjectsPerDay is set", () => {
      const records = [{ date: D("2026-09-28"), status: "present" as const }];
      expect(dailyFromSubjects(records, 5).presentDays).toBe(0);
      expect(dailyFromSubjects(records, 1).presentDays).toBe(1);
    });
  });

  describe("computeRiskFactors dual-mode", () => {
    const base = {
      finalGrades: [],
      anecdotalCount: 0,
      enrolled: 40,
    };
    it("legacy rows use present/enrolled", () => {
      // 1 present of 40 enrolled -> flagged.
      const flags = computeRiskFactors({
        ...base,
        attendance: [{ status: "present" }],
      });
      expect(flags.attendanceFlag).toBe(true);
    });
    it("subject rows use present/subjectSessions (no enrolled inflation)", () => {
      // 8 present of 10 subject sessions = 80% -> NOT flagged, even though
      // 8 present of 40 enrolled would flag under the legacy rule.
      const attendance = Array.from({ length: 10 }, (_, i) => ({
        status: i < 8 ? "present" : "absent",
        subjectId: "math",
      }));
      const flags = computeRiskFactors({ ...base, attendance });
      expect(flags.attendanceFlag).toBe(false);
    });
    it("subject rows below 80% flag", () => {
      const attendance = Array.from({ length: 10 }, (_, i) => ({
        status: i < 5 ? "present" : "absent",
        subjectId: "math",
      }));
      const flags = computeRiskFactors({ ...base, attendance });
      expect(flags.attendanceFlag).toBe(true);
    });
  });
});
