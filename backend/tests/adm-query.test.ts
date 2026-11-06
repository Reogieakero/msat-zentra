import { describe, it, expect } from "vitest";
import {
  admApprovalsQuerySchema,
  admDevicesQuerySchema,
  admMyCasesQuerySchema,
  admReferralsQuerySchema,
} from "../src/modules/adm/adm.schemas.js";

describe("ADM list query validation (pageSize capped at 15)", () => {
  it("rejects oversized pages on referrals/all (services clamp as fallback)", () => {
    const parsed = admReferralsQuerySchema.parse({ page: "2", pageSize: "15" });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(15);
    expect(admReferralsQuerySchema.safeParse({ pageSize: "50" }).success).toBe(false);
  });

  it("rejects invalid eligibility values", () => {
    expect(admReferralsQuerySchema.safeParse({ eligibility: "all" }).success).toBe(false);
    expect(
      admReferralsQuerySchema.safeParse({ eligibility: "eligible" }).success,
    ).toBe(true);
  });

  it("caps approvals, devices, and my-cases pages", () => {
    expect(admApprovalsQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
    expect(admApprovalsQuerySchema.parse({ pageSize: "15" }).pageSize).toBe(15);
    expect(admDevicesQuerySchema.safeParse({ pageSize: "99" }).success).toBe(false);
    expect(admDevicesQuerySchema.parse({ status: "issued", pageSize: "15" }).pageSize).toBe(15);
    expect(admDevicesQuerySchema.safeParse({ order: "sideways" }).success).toBe(false);
    expect(admMyCasesQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
  });

  it("trims long free-text queries", () => {
    expect(admReferralsQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(admMyCasesQuerySchema.safeParse({ highlight: "y".repeat(121) }).success).toBe(false);
  });
});
