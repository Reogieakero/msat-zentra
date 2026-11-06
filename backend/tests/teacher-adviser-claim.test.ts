import { describe, it, expect } from "vitest";
import { matchesAdviserName } from "../src/modules/teacher/advisory.repository.js";

describe("Adviser self-claim name match", () => {
  it("matches identical names", () => {
    expect(matchesAdviserName("Juan Dela Cruz", "Juan Dela Cruz")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(matchesAdviserName("  juan dela cruz ", "Juan Dela Cruz")).toBe(true);
    expect(matchesAdviserName("JUAN DELA CRUZ", "juan dela cruz")).toBe(true);
  });

  it("rejects different names and blanks", () => {
    expect(matchesAdviserName("Juan Dela Cruz", "Maria Santos")).toBe(false);
    expect(matchesAdviserName("Juan Dela", "Juan Dela Cruz")).toBe(false);
    expect(matchesAdviserName(null, "Juan Dela Cruz")).toBe(false);
    expect(matchesAdviserName("", "Juan Dela Cruz")).toBe(false);
    expect(matchesAdviserName("Juan Dela Cruz", "")).toBe(false);
  });
});
