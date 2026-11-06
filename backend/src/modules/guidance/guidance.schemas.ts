import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { MASCOT_CHARACTERS } from "../../services/mascot.js";

export const consultReviewSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  outcome: z.enum(["endorse", "reject"]),

  clinicSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1).optional(),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

export const guidanceProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  mascot: z.enum(MASCOT_CHARACTERS).nullable().optional(),
  primaryColor: HEX_COLOR.nullable().optional(),
  secondaryColor: HEX_COLOR.nullable().optional(),
});

export const guidancePhotoSchema = z.object({
  photoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
    .max(2_800_000),
});

/** Shared list-query validation: page/pageSize capped at 15, trimmed filters. */
export const guidanceAlertsQuerySchema = paginationQuerySchema().extend({
  level: z.enum(["High", "Moderate"]).optional(),
  factor: z.enum(["academic", "attendance", "behavioral"]).optional(),
});

export const guidanceAnecdotalQuerySchema = paginationQuerySchema().extend({
  category: z.enum(["behavioral", "bullying", "academic", "attendance", "health"]).optional(),
  type: z.enum(["adm", "counseling"]).optional(),
  docs: z.enum(["0", "1"]).optional(),
});

/** Merged alerts desk (guidance referrals + live interventions), server-paged. */
export const guidanceAlertCasesQuerySchema = paginationQuerySchema().extend({
  type: z.enum(["ADM", "Counseling", "Intervention"]).optional(),
  risk: z.enum(["High", "Moderate", "Low"]).optional(),
});

export const guidanceCasesQuerySchema = paginationQuerySchema(16).extend({
  status: z
    .enum(["pending", "in_progress", "resolved", "escalated", "follow_up", "info_requested", "dismissed"])
    .optional(),
  type: z.enum(["adm", "counseling"]).optional(),
  booked: z.enum(["0", "1"]).optional(),
  completed: z.enum(["0", "1"]).optional(),
  open: z.enum(["0", "1"]).optional(),
  highlight: z.string().trim().max(120).optional(),
});
