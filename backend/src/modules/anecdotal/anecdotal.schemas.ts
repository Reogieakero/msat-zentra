import { z } from "zod";

export const createSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),

  termId: z.string().min(1).optional(),
  observationDatetime: z.string().datetime(),
  descriptionOfIncident: z.string().min(1),
  descriptionOfLocation: z.string().optional(),
  notesRecommendationsActions: z.string().optional(),
  classPerformance: z.string().optional(),
  attendanceSummary: z.string().optional(),
  category: z.enum(["behavioral", "bullying", "academic", "attendance", "health"]).default("behavioral"),
  confidentialityLevel: z.enum(["restricted", "confidential"]).default("restricted"),
  folderId: z.string().min(1).optional(),
});

export const followupSchema = z.object({ notes: z.string().min(1) });

export const referSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
  reason: z.string().min(1),

  consultReviewer: z.enum(["nurse", "guidance_counselor", "lrpc"]).optional(),
}).strict();

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Folder name is required")
  .max(60, "Folder name must be 60 characters or fewer");

export const folderSchema = z.object({ name: folderNameSchema });

export const fileFolderSchema = z.object({ folderId: z.string().min(1).nullable() });

export const signSchema = z.object({ signatureImage: z.string().min(1) });
