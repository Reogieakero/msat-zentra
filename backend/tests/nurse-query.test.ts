import { describe, it, expect } from "vitest";
import {
  referralsMineQuerySchema,
  referralsQueueQuerySchema,
} from "../src/modules/referrals/referrals.schemas.js";

describe("Referrals queue query validation (pageSize capped at 16)", () => {
  it("rejects oversized pages on the shared queue", () => {
    expect(referralsQueueQuerySchema.safeParse({ pageSize: "50" }).success).toBe(false);
    expect(referralsQueueQuerySchema.parse({ pageSize: "15" }).pageSize).toBe(15);
    // The ADM kanban board pages a 4×4 grid — 16 is valid for the shared
    // queue, while the teacher "mine" list keeps the global 15 ceiling.
    expect(referralsQueueQuerySchema.parse({ pageSize: "16" }).pageSize).toBe(16);
    expect(referralsMineQuerySchema.safeParse({ pageSize: "16" }).success).toBe(false);
    expect(referralsMineQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
  });

  it("accepts queue filters and trims long free text", () => {
    const parsed = referralsQueueQuerySchema.parse({
      track: "clinic",
      status: "pending",
      q: "  cruz  ",
    });
    expect(parsed.track).toBe("clinic");
    expect(parsed.status).toBe("pending");
    expect(referralsQueueQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(referralsQueueQuerySchema.safeParse({ highlight: "y".repeat(121) }).success).toBe(false);
  });
});
