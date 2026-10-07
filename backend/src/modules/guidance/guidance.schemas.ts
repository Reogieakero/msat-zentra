import { z } from "zod";

// Request validation for the guidance desk (POST/PATCH bodies).
// Business-rule validation (receiver enforcement, term guards, resolve
// gates) lives in src/services/guidance/*.service.ts; these schemas only
// check request shape.

// Guidance consultation review on an ADM-purpose referral sitting at the
// consultation stage with no learner profile yet.
export const consultReviewSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  outcome: z.enum(["endorse", "reject"]),
  // Optional first session booked alongside an endorsement (same pattern
  // as the nurse ADM review) — standalone booking while pending goes
  // through the shared session endpoints instead.
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
  primaryColor: HEX_COLOR.nullable().optional(),
  secondaryColor: HEX_COLOR.nullable().optional(),
});

export const guidancePhotoSchema = z.object({
  photoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
    .max(2_800_000),
});
