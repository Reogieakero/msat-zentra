import { z } from "zod";

// Request validation for attendance taking (POST bodies).
// Business-rule validation (section ownership, date locks, enrollment)
// lives in src/services/attendance/*.service.ts; these schemas only check
// request shape.

export const recordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
});

// Per-subject bulk contract. `session` is legacy-only: when `subjectId` is
// present the subject path runs (slot disambiguates same-day repeats);
// otherwise the frozen AM/PM path runs (adviser-only, unchanged behavior).
export const bulkSchema = z.object({
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  date: z.string().datetime(),
  subjectId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).optional(),
  slot: z.coerce.number().int().min(1).max(10).optional().default(1),
  session: z.enum(["AM", "PM"]).optional(),
  // Bound: one class sheet per request — caps payload and write fan-out.
  records: z.array(recordSchema).min(1).max(300),
});
