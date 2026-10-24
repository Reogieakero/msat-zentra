import { describe, expect, it } from "vitest";
import { canBypassSharing, BYPASS_SHARE_ROLES } from "../src/services/teacher/dataShare.service.js";

describe("dataShare bypass", () => {
  it("owner always bypasses", () => {
    expect(canBypassSharing("guidance_counselor", "u1", ["u1", "u2"])).toBe(true);
  });
  it("principal bypasses", () => {
    expect(BYPASS_SHARE_ROLES.has("principal")).toBe(true);
    expect(canBypassSharing("principal", "p1", ["t1"])).toBe(true);
  });
  it("guidance does not bypass others", () => {
    expect(canBypassSharing("guidance_counselor", "g1", ["t1"])).toBe(false);
  });
  it("adviser does not bypass others", () => {
    expect(canBypassSharing("adviser", "a1", ["t1"])).toBe(false);
  });
});
