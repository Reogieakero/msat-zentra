import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { MASCOT_CHARACTERS } from "../../services/mascot.js";

export const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

export const registryProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  mascot: z.enum(MASCOT_CHARACTERS).nullable().optional(),
  primaryColor: HEX_COLOR.nullable().optional(),
  secondaryColor: HEX_COLOR.nullable().optional(),
});

export const registryPhotoSchema = z.object({
  photoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
    .max(2_800_000),
});

/** Registry list-query validation: page/pageSize capped at 15, trimmed filters. */
export const registryFinalGradesQuerySchema = paginationQuerySchema();

export const registryAccountsAuditQuerySchema = paginationQuerySchema();

export const registryAccessRequestsQuerySchema = paginationQuerySchema().extend({
  status: z.string().trim().max(40).optional(),
});
