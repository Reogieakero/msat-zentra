import { describe, it, expect } from "vitest";
import {
  registryAccessRequestsQuerySchema,
  registryAccountsAuditQuerySchema,
  registryFinalGradesQuerySchema,
} from "../src/modules/registry/registry.schemas.js";
import { pendingAccountsQuerySchema } from "../src/modules/auth/auth.schemas.js";
import { buildAdvisoryIdentity } from "../src/services/registry/access.service.js";

describe("Registry list query validation (pageSize capped at 15)", () => {
  it("rejects oversized pages on finals and audit lists", () => {
    expect(registryFinalGradesQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
    expect(registryFinalGradesQuerySchema.parse({ pageSize: "15" }).pageSize).toBe(15);
    expect(registryAccountsAuditQuerySchema.safeParse({ pageSize: "50" }).success).toBe(false);
  });

  it("rejects oversized pages on pending accounts and access requests", () => {
    expect(pendingAccountsQuerySchema.safeParse({ pageSize: "25" }).success).toBe(false);
    expect(pendingAccountsQuerySchema.parse({ role: "student", pageSize: "15" }).pageSize).toBe(15);
    expect(registryAccessRequestsQuerySchema.safeParse({ pageSize: "20" }).success).toBe(false);
  });

  it("trims long free-text queries", () => {
    expect(registryAccessRequestsQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
  });
});

describe("Adviser access advisory identity (profiles + roster-only)", () => {
  it("keeps roster-only sections visible even with zero registered profiles", () => {
    const bySection = buildAdvisoryIdentity(
      [],
      [
        { sectionId: "sec-1", lrn: "111", name: "Roster One" },
        { sectionId: "sec-1", lrn: "222", name: "Roster Two" },
      ],
    );
    expect([...(bySection.get("sec-1")?.keys() ?? [])].sort()).toEqual(["111", "222"]);
  });

  it("prefers the section profile name (and mascot) over the roster for the same LRN", () => {
    const bySection = buildAdvisoryIdentity(
      [{ sectionId: "sec-1", lrn: "111", name: "Profile Name", mascot: "cat" }],
      [{ sectionId: "sec-1", lrn: "111", name: "Roster Name", mascot: "dog" }],
    );
    expect(bySection.get("sec-1")?.get("111")).toEqual({ name: "Profile Name", mascot: "cat" });
  });

  it("keeps profile-only and mixed sections intact", () => {
    const bySection = buildAdvisoryIdentity(
      [
        { sectionId: "sec-1", lrn: "111", name: "Profile One" },
        { sectionId: "sec-2", lrn: "333", name: "Profile Other" },
      ],
      [{ sectionId: "sec-1", lrn: "222", name: "Roster Two" }],
    );
    expect([...(bySection.get("sec-1")?.keys() ?? [])].sort()).toEqual(["111", "222"]);
    expect([...(bySection.get("sec-2")?.keys() ?? [])]).toEqual(["333"]);
  });
});
