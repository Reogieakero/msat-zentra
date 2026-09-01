import { describe, it, expect } from "vitest";
import {
  buildDayAxis,
  countSchoolDays,
  formatDateKey,
  isWeekendKey,
  groupSectionDay,
  dailyPresentPercent,
  avgPresentPercent,
  below80Days,
  attendanceTrend,
} from "../src/services/attendance.js";

describe("attendance engine (canonical single source of truth)", () => {
  describe("buildDayAxis + countSchoolDays", () => {
    it("produces a continuous inclusive axis and counts weekdays only", () => {
      const axis = buildDayAxis("2026-01-05T00:00:00.000Z"); // Monday
      expect(axis[0]).toBe("2026-01-05");
      expect(axis).toContain("2026-01-10"); // Saturday
      const weekdays = countSchoolDays(axis);
      // Independent check: count Mon–Fri across the same range.
      const expected = axis.filter((k) => {
        const wd = new Date(k + "T00:00:00Z").getUTCDay();
        return wd !== 0 && wd !== 6;
      }).length;
      expect(weekdays).toBe(expected);
      expect(isWeekendKey("2026-01-10")).toBe(true); // Sat
      expect(isWeekendKey("2026-01-05")).toBe(false); // Mon
    });
  });

  describe("formatDateKey", () => {
    it("formats a UTC key for display", () => {
      expect(formatDateKey("2026-01-05")).toMatch(/Jan 5, 2026/);
    });
  });

  describe("groupSectionDay", () => {
    it("tallies present/late/excused and submitted total per section/day", () => {
      const grouped = groupSectionDay([
        { sectionId: "a", date: new Date("2026-01-05T00:00:00Z"), status: "present" },
        { sectionId: "a", date: new Date("2026-01-05T01:00:00Z"), status: "late" },
        { sectionId: "a", date: new Date("2026-01-05T02:00:00Z"), status: "excused" },
        { sectionId: "a", date: new Date("2026-01-05T03:00:00Z"), status: "absent" },
      ]);
      const cell = grouped["a"]!.get("2026-01-05")!;
      expect(cell.present).toBe(1);
      expect(cell.late).toBe(1);
      expect(cell.excused).toBe(1);
      expect(cell.total).toBe(4); // absent is counted toward submitted total
    });
  });

  describe("dailyPresentPercent", () => {
    it("computes present ÷ headcount as 0..100", () => {
      expect(dailyPresentPercent(9, 10)).toBe(90);
      expect(dailyPresentPercent(0, 10)).toBe(0);
      expect(dailyPresentPercent(5, 0)).toBe(0); // guard: no headcount
    });
  });

  describe("avgPresentPercent", () => {
    it("is average present per school day ÷ headcount (0..100)", () => {
      const days = [
        { present: 10, late: 0, excused: 0, total: 10 },
        { present: 8, late: 0, excused: 0, total: 8 },
        { present: 0, late: 0, excused: 0, total: 0 },
        { present: 10, late: 0, excused: 0, total: 10 },
      ];
      // present=28 over 4 days, headcount=10, schoolDays=4 → 28/40 = 70%
      expect(avgPresentPercent(days, 10, 4)).toBe(70);
      // Missing records are treated as no-present days (not a denominator shift).
      // But the canonical denominator is headcount × schoolDays, so it stays.
      expect(avgPresentPercent(days, 10, 4)).toBe(70);
    });

    it("returns 0 when headcount or schoolDays is 0", () => {
      expect(avgPresentPercent([{ present: 5, late: 0, excused: 0, total: 5 }], 0, 4)).toBe(0);
      expect(avgPresentPercent([{ present: 5, late: 0, excused: 0, total: 5 }], 5, 0)).toBe(0);
    });
  });

  describe("below80Days", () => {
    it("counts days with submitted records under 80% headcount", () => {
      const days = [
        { present: 9, late: 0, excused: 0, total: 10 }, // 90% → not counted
        { present: 7, late: 0, excused: 0, total: 10 }, // 70% → counted
        { present: 0, late: 0, excused: 0, total: 0 }, // no records → ignored
        { present: 10, late: 0, excused: 0, total: 10 }, // 100% → not
      ];
      expect(below80Days(days, 10)).toBe(1);
    });
  });

  describe("attendanceTrend", () => {
    it("flat when insufficient data", () => {
      expect(attendanceTrend([{ present: 8, late: 0, excused: 0, total: 8 }], 10)).toBe("flat");
    });

    it("up when the second half clearly beats the first", () => {
      const days = [
        { present: 6, late: 0, excused: 0, total: 6 },
        { present: 6, late: 0, excused: 0, total: 6 },
        { present: 9, late: 0, excused: 0, total: 9 },
        { present: 9, late: 0, excused: 0, total: 9 },
      ];
      expect(attendanceTrend(days, 10)).toBe("up");
    });

    it("down when the second half clearly loses to the first", () => {
      const days = [
        { present: 9, late: 0, excused: 0, total: 9 },
        { present: 9, late: 0, excused: 0, total: 9 },
        { present: 5, late: 0, excused: 0, total: 5 },
        { present: 5, late: 0, excused: 0, total: 5 },
      ];
      expect(attendanceTrend(days, 10)).toBe("down");
    });
  });
});
