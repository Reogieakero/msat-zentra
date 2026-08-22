import { describe, it, expect } from "vitest";
import { canTransition, assertTransition } from "../src/services/adm.js";
import { AppError } from "../src/lib/errors.js";

describe("ADM state machine (§6.4)", () => {
  it("allows linear transitions", () => {
    expect(canTransition("anecdotal", "referred")).toBe(true);
    expect(canTransition("referred", "parent_meeting")).toBe(true);
    expect(canTransition("principal_approval", "release")).toBe(true);
  });
  it("rejects illegal transitions", () => {
    expect(canTransition("anecdotal", "release")).toBe(false);
    expect(() => assertTransition("anecdotal", "release")).toThrow(AppError);
  });
});
