import { describe, it, expect } from "vitest";
import { overdueCutoff, isOverdue } from "../src/services/gradeFlags.js";

const DAY = 86_400_000;

describe("Grade flag escalation", () => {
  const now = new Date("2026-09-04T12:00:00Z");

  it("computes the overdue cutoff from the threshold", () => {
    expect(overdueCutoff(now, 7).getTime()).toBe(now.getTime() - 7 * DAY);
  });

  it("marks flags older than the threshold as overdue", () => {
    expect(isOverdue(new Date(now.getTime() - 10 * DAY), now, 7)).toBe(true);
    expect(isOverdue(new Date(now.getTime() - 8 * DAY), now, 7)).toBe(true);
  });

  it("keeps fresh flags open", () => {
    expect(isOverdue(new Date(now.getTime() - 6 * DAY), now, 7)).toBe(false);
    expect(isOverdue(now, now, 7)).toBe(false);
  });

  it("treats the exact cutoff boundary as not overdue", () => {
    expect(isOverdue(new Date(now.getTime() - 7 * DAY), now, 7)).toBe(false);
  });
});
