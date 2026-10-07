import { z } from "zod";

// Request validation for grade flags (POST bodies + list query).
// Business-rule validation (ownership, locks, targets) lives in
// src/services/teacher/gradeFlags.service.ts; these schemas only check
// request shape.

export const REASONS = [
  "wrong_score",
  "missing_assessment",
  "transmutation_error",
  "late_submission",
  "other",
] as const;

export const raiseSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  reason: z.enum(REASONS),
  note: z.string().max(2000).optional(),
});

export const resolveSchema = z.object({
  resolutionNote: z.string().min(1).max(2000),
});

export const listQuerySchema = z.object({
  scope: z.enum(["mine", "against-me", "advisees"]).default("mine"),
  status: z.enum(["open", "resolved", "escalated"]).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
