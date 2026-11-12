import { z } from "zod";

export const rosterSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  lrn: z.string().trim().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
  sectionId: z.string().min(1).optional(),
  // Transferees are rated from the day they were enlisted, not term start.
  learnerType: z.enum(["regular", "transferee"]).optional(),
});

/** Advisory list edit — name and LRN stay 12 digits, numbers only. */
export const rosterUpdateSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  lrn: z.string().trim().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
});
