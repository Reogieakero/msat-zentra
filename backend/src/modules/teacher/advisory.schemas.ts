import { z } from "zod";

// Request validation for the advisory desk (POST bodies).
// Business-rule validation (advisership gates, LRN uniqueness) lives in
// src/services/advisory/*.service.ts; these schemas only check request shape.

// POST /api/teacher/advisory/roster — enlist a student into the adviser's
// section roster (enrolled, no login account yet). When the student later
// registers with the same LRN, the registrar's breakdown links them.
// Adviser-only (404 otherwise).
export const rosterSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  lrn: z.string().trim().min(1).max(32),
  sectionId: z.string().min(1).optional(),
});
