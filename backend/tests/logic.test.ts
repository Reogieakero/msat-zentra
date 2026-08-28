import { describe, it, expect } from "vitest";
import { canTransition, assertTransition } from "../src/services/adm.js";
import { AppError } from "../src/lib/errors.js";

describe("ADM state machine (§6.4)", () => {
  it("allows linear transitions", () => {
    expect(canTransition("anecdotal", "consultation")).toBe(true);
    expect(canTransition("referred", "eligibility")).toBe(true);
    expect(canTransition("principal_approval", "certification")).toBe(true);
  });
  it("rejects illegal transitions", () => {
    expect(canTransition("anecdotal", "completion")).toBe(false);
    expect(() => assertTransition("anecdotal", "completion")).toThrow(AppError);
  });
});
