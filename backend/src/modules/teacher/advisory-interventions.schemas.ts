import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const ADVISORY_INTERVENTION_LEVELS = ["High", "Moderate", "Low"] as const;
export type AdvisoryInterventionLevel = (typeof ADVISORY_INTERVENTION_LEVELS)[number];

export const ADVISORY_INTERVENTION_FACTORS = [
  "academic",
  "attendance",
  "behavioral",
] as const;
export type AdvisoryInterventionFactor = (typeof ADVISORY_INTERVENTION_FACTORS)[number];

/** `none` = a flagged advisee guidance has not opened a plan for yet. */
export const ADVISORY_INTERVENTION_OUTCOMES = [
  "ongoing",
  "resolved",
  "unresolved",
  "none",
] as const;
export type AdvisoryInterventionOutcome = (typeof ADVISORY_INTERVENTION_OUTCOMES)[number];

/** Adviser desk cards page a 4x4 board grid - allow 16 per page. */
export const ADVISORY_INTERVENTIONS_MAX_PAGE_SIZE = 16;

export const advisoryInterventionsQuerySchema = paginationQuerySchema(
  ADVISORY_INTERVENTIONS_MAX_PAGE_SIZE,
).extend({
  sectionId: z.string().trim().max(64).optional(),
  level: z.enum(ADVISORY_INTERVENTION_LEVELS).optional(),
  factor: z.enum(ADVISORY_INTERVENTION_FACTORS).optional(),
  outcome: z.enum(ADVISORY_INTERVENTION_OUTCOMES).optional(),
});
