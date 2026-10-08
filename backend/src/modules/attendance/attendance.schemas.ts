import { z } from "zod";

export const recordSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "excused"]),
});

export const bulkSchema = z.object({
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  date: z.string().datetime(),
  subjectId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).optional(),
  slot: z.coerce.number().int().min(1).max(10).optional().default(1),
  session: z.enum(["AM", "PM"]).optional(),

  records: z.array(recordSchema).min(1).max(300),
});
