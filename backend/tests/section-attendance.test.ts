import { describe, it, expect } from "vitest";
import {
  buildOfferedMap,
  sectionStrictDays,
  studentDayOutcomes,
  type SectionSubjectTake,
} from "../src/services/attendance.js";

// Monday 2026-01-05: offerings MATH + ENG for section "s1".
const MON = new Date("2026-01-05T00:00:00Z");
const OFFERED = buildOfferedMap([
  { sectionId: "s1", subjectId: "math", day: 1 },
  { sectionId: "s1", subjectId: "eng", day: 1 },
]);

function take(
  studentKey: string,
  subjectId: string,
  status: SectionSubjectTake["status"],
  date = MON,
  sectionId = "s1"
): SectionSubjectTake {
  return { sectionId, studentKey, subjectId, date, status };
}

describe("strict per-day section attendance", () => {
  it("marks present only when present in every offered subject that day", () => {
    const days = sectionStrictDays(
      [take("u1", "math", "present"), take("u1", "eng", "present")],
      OFFERED
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect([...cell.present]).toEqual(["u1"]);
    expect(cell.taken.has("u1")).toBe(true);
  });

  it("late in one subject breaks the day into the late bucket", () => {
    const days = sectionStrictDays(
      [take("u1", "math", "present"), take("u1", "eng", "late")],
      OFFERED
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect(cell.present.size).toBe(0);
    expect([...cell.late]).toEqual(["u1"]);
  });

  it("absent in one subject leaves the student out of every bucket (complement-absent)", () => {
    const days = sectionStrictDays(
      [take("u1", "math", "present"), take("u1", "eng", "absent")],
      OFFERED
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect(cell.present.size).toBe(0);
    expect(cell.late.size).toBe(0);
    expect(cell.excused.size).toBe(0);
    expect(cell.taken.has("u1")).toBe(true);
  });

  it("excused in one subject lands in the excused bucket", () => {
    const days = sectionStrictDays(
      [take("u1", "math", "present"), take("u1", "eng", "excused")],
      OFFERED
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect(cell.present.size).toBe(0);
    expect([...cell.excused]).toEqual(["u1"]);
  });

  it("a missing subject take breaks the day (strict coverage)", () => {
    const days = sectionStrictDays([take("u1", "math", "present")], OFFERED);
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect(cell.present.size).toBe(0);
    expect(cell.taken.has("u1")).toBe(true);
  });

  it("falls back to recorded subjects when the weekday has no offerings", () => {
    const empty = buildOfferedMap([]);
    const days = sectionStrictDays(
      [take("u1", "math", "present"), take("u1", "eng", "present")],
      empty
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect([...cell.present]).toEqual(["u1"]);
  });

  it("double takes in one subject require every take present", () => {
    const days = sectionStrictDays(
      [
        take("u1", "math", "present"),
        take("u1", "math", "absent"),
        take("u1", "eng", "present"),
      ],
      OFFERED
    );
    const cell = days.get("s1")!.get("2026-01-05")!;
    expect(cell.present.size).toBe(0);
  });
});

describe("studentDayOutcomes", () => {
  it("classifies exactly one outcome per axis day (unrecorded = absent)", () => {
    const days = sectionStrictDays(
      [
        take("u1", "math", "present"),
        take("u1", "eng", "present"),
        take("u2", "math", "present"),
        take("u2", "eng", "late"),
      ],
      OFFERED
    );
    const out = studentDayOutcomes(days.get("s1"), ["u1", "u2", "u3"], [
      "2026-01-05",
      "2026-01-06",
    ]);
    expect(out.get("u1")).toEqual({ present: 1, late: 0, excused: 0, absent: 1 });
    expect(out.get("u2")).toEqual({ present: 0, late: 1, excused: 0, absent: 1 });
    // Zero takes all term → 0% (same rule as the legacy per-student view).
    expect(out.get("u3")).toEqual({ present: 0, late: 0, excused: 0, absent: 2 });
    for (const row of out.values()) {
      expect(row.present + row.late + row.excused + row.absent).toBe(2);
    }
  });
});
