import { describe, it, expect } from "vitest";
import {
  ADVISER_CODE_PREFIX,
  matchesAdviserCode,
  mintAdviserCode,
  normalizeAdviserCode,
} from "../src/modules/academics/adviserCode.js";

describe("Adviser code mint + verify", () => {
  it("mints ADV- codes with 5 unambiguous chars", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = mintAdviserCode();
      expect(code.startsWith(ADVISER_CODE_PREFIX)).toBe(true);
      expect(code).toMatch(/^ADV-[A-Z2-9]{5}$/);
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("mints unique codes across a batch-sized run", () => {
    const codes = new Set(Array.from({ length: 20 }, () => mintAdviserCode()));
    // 32^5 space — 20 mints must not collide in practice.
    expect(codes.size).toBe(20);
  });

  it("matches case-insensitively with surrounding whitespace", () => {
    expect(matchesAdviserCode("ADV-7K2Q9", "adv-7k2q9")).toBe(true);
    expect(matchesAdviserCode("ADV-7K2Q9", "  ADV-7K2Q9  ")).toBe(true);
  });

  it("rejects mismatches and blanks", () => {
    expect(matchesAdviserCode("ADV-7K2Q9", "ADV-00000")).toBe(false);
    expect(matchesAdviserCode(null, "ADV-7K2Q9")).toBe(false);
    expect(matchesAdviserCode("ADV-7K2Q9", "")).toBe(false);
    expect(matchesAdviserCode("", "")).toBe(false);
    expect(matchesAdviserCode(undefined, undefined)).toBe(false);
  });

  it("normalizes codes for storage-safe comparison", () => {
    expect(normalizeAdviserCode("  adv-7k2q9 ")).toBe("ADV-7K2Q9");
    expect(normalizeAdviserCode(null)).toBe("");
  });
});
