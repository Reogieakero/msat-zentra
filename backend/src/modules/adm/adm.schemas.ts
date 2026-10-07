import { z } from "zod";
import { ADM_STAGES, type AdmStage } from "../../services/adm.js";

// Request validation for the ADM Coordinator desk (POST/PATCH bodies).
// Business-rule validation (stage gates, endorsement, locks) lives in
// src/services/adm/*.service.ts; these schemas only check request shape.

export const profileSchema = z.object({
  studentId: z.string().min(1).optional(),
  referralId: z.string().min(1),
  termId: z.string().min(1),
  certificationDetails: z.record(z.any()).optional(),
});

export const deviceIssueSchema = z.object({
  admLearnerProfileId: z.string().min(1),
  deviceType: z.string().min(1),
  deviceSerial: z.string().min(1),
  issuedDate: z.string().datetime().optional(),
  conditionNotes: z.string().optional(),
});

export const deviceReturnSchema = z.object({
  returnedDate: z.string().datetime().optional(),
});

export const meetingBookSchema = z.object({
  meetingDatetime: z.string().datetime(),
  venue: z.enum(["school", "home"]).default("school"),
  minutesOfMeeting: z.string().optional(),
  attendanceLogbookRef: z.string().optional(),
  // Staff invited to the meeting (guidance / nurse / adviser user ids).
  inviteeIds: z.array(z.string().uuid()).max(10).optional(),
});

export const meetingRescheduleSchema = z.object({
  meetingDatetime: z.string().datetime(),
  venue: z.enum(["school", "home"]).default("school"),
  attendanceLogbookRef: z.string().trim().max(200).optional(),
  // Omitted = keep the current invite list; provided = replace it.
  inviteeIds: z.array(z.string().uuid()).max(10).optional(),
});

export const meetingOutcomeSchema = z.object({
  attended: z.boolean(),
  minutesOfMeeting: z.string().optional(),
  attendanceLogbookRef: z.string().optional(),
  parentConfirmedAt: z.string().datetime().optional(),
  // People present, logged by the ADM Coordinator with the outcome:
  // at most 20 { name, role } entries. Entries checked off the invitee
  // checklist carry the invited staff account id (userId) so attendance
  // links back to the invite.
  attendees: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        role: z.enum([
          "parent_guardian",
          "teacher",
          "student",
          "guidance_counselor",
          "nurse",
          "principal",
          "lrpc",
          "other",
        ]),
        userId: z.string().uuid().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export const advanceSchema = z.object({
  stage: z.enum(ADM_STAGES as [AdmStage, ...AdmStage[]]),
});

export const certificationSchema = z.object({
  recommendation: z.string().trim().min(10).max(5000),
});

export const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #RRGGBB hex value");

export const coordinatorProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  primaryColor: HEX_COLOR.nullable().optional(),
  secondaryColor: HEX_COLOR.nullable().optional(),
});

export const coordinatorPhotoSchema = z.object({
  photoUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|gif|webp);base64,/, "Photo must be a PNG, JPEG, GIF, or WebP data URL")
    .max(2_800_000),
});
