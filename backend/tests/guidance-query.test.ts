import { describe, it, expect } from "vitest";
import {
  guidanceAlertsQuerySchema,
  guidanceAnecdotalQuerySchema,
  guidanceCasesQuerySchema,
} from "../src/modules/guidance/guidance.schemas.js";
import { interventionsQueueQuerySchema } from "../src/modules/interventions/interventions.schemas.js";

describe("Guidance list query validation (pageSize capped at 15)", () => {
  it("rejects oversized pages across guidance queues", () => {
    expect(guidanceAlertsQuerySchema.safeParse({ pageSize: "50" }).success).toBe(false);
    expect(guidanceAlertsQuerySchema.parse({ pageSize: "15" }).pageSize).toBe(15);
    expect(guidanceAnecdotalQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
    expect(guidanceCasesQuerySchema.safeParse({ pageSize: "30" }).success).toBe(false);
    expect(interventionsQueueQuerySchema.safeParse({ pageSize: "75" }).success).toBe(false);
  });

  it("rejects out-of-vocabulary filter values", () => {
    expect(guidanceAlertsQuerySchema.safeParse({ level: "Low" }).success).toBe(false);
    expect(guidanceAlertsQuerySchema.safeParse({ level: "High" }).success).toBe(true);
    expect(guidanceAnecdotalQuerySchema.safeParse({ category: "other" }).success).toBe(false);
    expect(guidanceCasesQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(guidanceCasesQuerySchema.safeParse({ status: "pending" }).success).toBe(true);
    expect(interventionsQueueQuerySchema.safeParse({ level: "Low" }).success).toBe(false);
    expect(interventionsQueueQuerySchema.safeParse({ outcome: "all" }).success).toBe(true);
  });

  it("trims long free-text queries", () => {
    expect(guidanceAlertsQuerySchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(guidanceCasesQuerySchema.safeParse({ highlight: "y".repeat(121) }).success).toBe(false);
  });
});
