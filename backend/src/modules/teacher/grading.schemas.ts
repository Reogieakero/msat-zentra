import { z } from "zod";

// Request validation for the teacher gradebook (POST/PATCH bodies).
// Business-rule validation (assignment ownership, grade bands, locks)
// lives in src/services/teacher/grading.service.ts; these schemas only
// check request shape.

export const COMPONENT_TYPES = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"] as const;

export const componentSchema = z.object({
  componentType: z.enum(COMPONENT_TYPES),
  weightPercentage: z.number().int().min(0).max(100),
});

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
