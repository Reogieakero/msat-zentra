import { describe, it, expect } from "vitest";
import {
  buildDayAxis,
  buildSchoolDayAxis,
  manilaKey,
  phTodayKey,
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
      const axis = buildDayAxis("2026-01-05T00:00:00.000Z");
      expect(axis[0]).toBe("2026-01-05");
      expect(axis).toContain("2026-01-10");
      const weekdays = countSchoolDays(axis);

      const expected = axis.filter((k) => {
        const wd = new Date(k + "T00:00:00Z").getUTCDay();
        return wd !== 0 && wd !== 6;
      }).length;
      expect(weekdays).toBe(expected);
      expect(isWeekendKey("2026-01-10")).toBe(true);
      expect(isWeekendKey("2026-01-05")).toBe(false);
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
      expect(cell.total).toBe(4);
    });
  });

  describe("dailyPresentPercent", () => {
    it("computes present ÷ headcount as 0..100", () => {
      expect(dailyPresentPercent(9, 10)).toBe(90);
      expect(dailyPresentPercent(0, 10)).toBe(0);
      expect(dailyPresentPercent(5, 0)).toBe(0);
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

      expect(avgPresentPercent(days, 10, 4)).toBe(70);

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
        { present: 9, late: 0, excused: 0, total: 10 },
        { present: 7, late: 0, excused: 0, total: 10 },
        { present: 0, late: 0, excused: 0, total: 0 },
        { present: 10, late: 0, excused: 0, total: 10 },
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

  describe("phTodayKey", () => {
    it("returns the Manila calendar day, not the UTC day", () => {

      expect(phTodayKey(new Date("2026-09-25T17:00:00.000Z"))).toBe("2026-09-26");

      expect(phTodayKey(new Date("2026-09-25T15:00:00.000Z"))).toBe("2026-09-25");
    });
  });

  describe("manilaKey", () => {
    it("formats any instant as its Asia/Manila calendar date", () => {

      expect(manilaKey(new Date("2026-09-15T16:00:00.000Z"))).toBe("2026-09-16");
      expect(manilaKey(new Date("2026-09-15T15:59:59.000Z"))).toBe("2026-09-15");
      expect(manilaKey(new Date("2026-12-18T15:00:00.000Z"))).toBe("2026-12-18");
    });
  });

  describe("buildSchoolDayAxis", () => {
    it("runs term start -> today with zero weekend keys", () => {
      const axis = buildSchoolDayAxis("2026-01-05T00:00:00.000Z");
      expect(axis.length).toBeGreaterThan(0);
      expect(axis[0]).toBe("2026-01-05");
      for (const key of axis) {
        expect(isWeekendKey(key)).toBe(false);
      }

      const full = buildDayAxis("2026-01-05T00:00:00.000Z");
      expect(axis.length).toBe(countSchoolDays(full));
    });
  });
});
