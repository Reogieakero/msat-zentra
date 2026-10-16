import { describe, it, expect } from "vitest";
import {
  MASCOT_CHARACTERS,
  isMascotCharacter,
  mascotFor,
  mascotForUnique,
  pickMascot,
  pickUniqueMascot,
} from "../src/services/mascot.js";

describe("student mascots", () => {
  it("has a 55-character pool matching the referrals StudentMascot", () => {
    expect(MASCOT_CHARACTERS).toHaveLength(55);
    for (const c of ["afro", "cat", "wizard", "kamran"]) {
      expect(isMascotCharacter(c)).toBe(true);
    }
    expect(isMascotCharacter("not-a-mascot")).toBe(false);
  });

  it("derives deterministically from fullName:lrn (frontend fallback parity)", () => {
    expect(mascotFor("Maria Santos", "201234567890")).toBe(
      pickMascot("Maria Santos:201234567890"),
    );
    expect(mascotFor("Maria Santos", "201234567890")).toBe(
      mascotFor("Maria Santos", "201234567890"),
    );
  });

  it("returns the canonical pick when nothing is taken", () => {
    expect(pickUniqueMascot("Ana Reyes:123", new Set())).toBe(
      pickMascot("Ana Reyes:123"),
    );
  });

  it("probes forward past taken characters deterministically", () => {
    const first = pickMascot("Juan Cruz:456");
    const idx = MASCOT_CHARACTERS.indexOf(first);
    const taken = new Set([first]);
    expect(pickUniqueMascot("Juan Cruz:456", taken)).toBe(
      MASCOT_CHARACTERS[(idx + 1) % MASCOT_CHARACTERS.length],
    );
    taken.add(MASCOT_CHARACTERS[(idx + 1) % MASCOT_CHARACTERS.length]!);
    expect(pickUniqueMascot("Juan Cruz:456", taken)).toBe(
      MASCOT_CHARACTERS[(idx + 2) % MASCOT_CHARACTERS.length],
    );
  });

  it("assigns distinct mascots across a section-sized set", () => {
    const taken = new Set<string>();
    const assigned: string[] = [];
    for (let i = 0; i < 55; i += 1) {
      const m = mascotForUnique(`Student ${i}`, `1000000000${String(i).padStart(2, "0")}`, taken);
      taken.add(m);
      assigned.push(m);
    }
    expect(new Set(assigned).size).toBe(55);
  });

  it("falls back to the canonical pick when the whole pool is taken", () => {
    const all = new Set<string>(MASCOT_CHARACTERS);
    expect(pickUniqueMascot("Anyone:789", all)).toBe(pickMascot("Anyone:789"));
  });
});
