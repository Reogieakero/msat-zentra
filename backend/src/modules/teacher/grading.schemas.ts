import { z } from "zod";

export const COMPONENT_TYPES = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"] as const;

export const componentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  weightPercentage: z.number().int().min(0).max(100),
});

// One round-trip for the whole weights editor. Saving three weights used to
// fire three POSTs, each re-running finals + risk recompute and cache
// invalidation for the class.
export const componentsBatchSchema = z
  .object({
    weights: z.array(componentSchema).min(1).max(3),
  })
  .refine(
    (v) => v.weights.reduce((s, w) => s + w.weightPercentage, 0) === 100,
    { message: "Weights must total 100%", path: ["weights"] },
  );

export const PRESETS = ["SHS", "JHS_LANG", "JHS_MATH_SCI", "JHS_MAPEH_TLE"] as const;

export const presetSchema = z.object({
  preset: z.enum(PRESETS),
});

export const assessmentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  title: z.string().trim().min(1).max(120),
  maxScore: z.number().positive().max(100000),
  dateGiven: z.string().datetime().optional(),
});

export const assessmentPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  maxScore: z.number().positive().max(100000).optional(),
  dateGiven: z.string().datetime().optional(),
});
