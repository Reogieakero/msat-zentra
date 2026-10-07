import { z } from "zod";

// Request validation for the teacher workspace (POST/PATCH bodies).
// Business-rule validation (master-teacher gates, grade bands, locks)
// lives in src/services/teacher/*.service.ts; these schemas only check
// request shape.

export const masterTeacherSchema = z.object({ isMasterTeacher: z.boolean() });

export const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

export const teacherProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  primaryColor: HEX_COLOR.nullable().optional(),
  secondaryColor: HEX_COLOR.nullable().optional(),
});

export const teacherPhotoSchema = z.object({
  photoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
    .max(2_800_000),
});

export const claimCodeSchema = z.object({ code: z.string().max(32) });

export const verifyCodeSchema = z.object({ code: z.string().max(32) });

export const scheduleAssignSchema = z.object({
  subjectId: z.string(),
  sectionId: z.string(),
});

const recessBodySchema = (minPeriod: number, maxPeriod: number) =>
  z.object({
    enabled: z.boolean(),
    afterPeriod: z.number().int().min(minPeriod).max(maxPeriod),
    mins: z.number().int().min(5).max(45),
  });

export const scheduleConfigBodySchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine(
      (v) => {
        const [h, m] = v.split(":").map(Number);
        return h >= 0 && h <= 23 && m >= 0 && m <= 59;
      },
      { message: "startTime must be a valid HH:MM time" }
    ),
  periodMins: z.number().int().min(15).max(120),
  lunch: z.object({
    afterPeriod: z.number().int().min(1).max(8),
    mins: z.number().int().min(15).max(180),
  }),
  morningRecess: recessBodySchema(1, 4),
  afternoonRecess: recessBodySchema(5, 8),
});

export const unlockSchema = z.object({ sectionId: z.string() });

export const submitSchema = z.object({ sectionId: z.string().optional() });

export const entrySchema = z.object({
  sectionId: z.string(),
  subjectId: z.string(),
  teacherNameId: z.string(),
  day: z.number().int().min(1).max(5),
  period: z.number().int().min(0).max(7),
});

export const teacherNameSchema = z.object({
  fullName: z.string().min(1).max(120),
});

export const subjectSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(24),
  gradeLevel: z.enum(["G7", "G8", "G9", "G10"]),
  category: z.enum(["CORE", "ELECTIVE"]).optional().default("CORE"),
});
