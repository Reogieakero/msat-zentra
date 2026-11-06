import { describe, it, expect } from "vitest";
import {
  attendanceSheetQuerySchema,
  teacherOverviewQuerySchema,
} from "../src/modules/teacher/teacher.schemas.js";
import { listQuerySchema } from "../src/modules/teacher/grade-flags.schemas.js";

describe("Teacher list query validation (sub-lists capped at 15)", () => {
  it("rejects oversized sub-list pages on the teacher overview", () => {
    expect(teacherOverviewQuerySchema.safeParse({ classLimit: "100" }).success).toBe(false);
    expect(teacherOverviewQuerySchema.parse({ classLimit: "15" }).classLimit).toBe(15);
    expect(teacherOverviewQuerySchema.safeParse({ advisoryLimit: "30" }).success).toBe(false);
  });

  it("rejects unknown overview scopes", () => {
    expect(teacherOverviewQuerySchema.safeParse({ scope: "everything" }).success).toBe(false);
    expect(teacherOverviewQuerySchema.parse({ scope: "gradebook" }).scope).toBe("gradebook");
  });

  it("validates the attendance-sheet filters", () => {
    const parsed = attendanceSheetQuerySchema.parse({ sectionId: "s1", slot: "3" });
    expect(parsed.slot).toBe(3);
    expect(attendanceSheetQuerySchema.safeParse({ slot: "11" }).success).toBe(false);
  });

  it("caps grade-flag pages at 15", () => {
    expect(listQuerySchema.safeParse({ pageSize: "50" }).success).toBe(false);
    expect(listQuerySchema.parse({ scope: "mine", pageSize: "15" }).pageSize).toBe(15);
  });
});
