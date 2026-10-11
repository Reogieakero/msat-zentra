import { describe, it, expect } from "vitest";
import {
  registryAccessRequestsQuerySchema,
  registryAccountsAuditQuerySchema,
  registryFinalGradesQuerySchema,
} from "../src/modules/registry/registry.schemas.js";
import { pendingAccountsQuerySchema } from "../src/modules/auth/auth.schemas.js";

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
    expect(registryFinalGradesQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
  });
});
