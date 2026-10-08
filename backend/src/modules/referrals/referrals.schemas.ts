import { z } from "zod";

export const statusSchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "escalated", "info_requested", "dismissed", "follow_up"]),
  resolutionSummary: z.string().trim().min(1).max(2000).optional(),
});

export const escalateSchema = z.object({
  escalationReason: z.string().min(1).max(500),
  escalatedTo: z.enum(["principal", "nurse", "adm_coordinator"]),
});

export const reassignSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
});

export const noteSchema = z.object({
  notes: z.string().min(1).max(2000),
});

export const followUpSchema = z.object({
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const dismissSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const specialistSchema = z.object({
  referredToRole: z.enum(["nurse", "adm_coordinator", "principal"]),
  reason: z.string().min(1).max(500),
});

export const admSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const acceptSchema = z.object({
  priority: z.enum(["low", "normal", "high"]),
  intakeNotes: z.string().trim().max(2000).optional(),
  firstSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const nurseAcceptSchema = z.object({
  intakeNotes: z.string().trim().max(2000).optional(),
  clinicSession: z
    .object({
      scheduledAt: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const clinicSessionSchema = z
  .object({
    scheduledAt: z.string().min(1),
    venue: z.string().trim().max(200).optional(),
  })
  .optional();

export const referralFormSchema = z
  .object({
    concerns: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    detailsOfConcern: z.string().trim().max(2000).optional(),
    nurseActions: z.string().trim().max(2000).optional(),
    followUp: z.string().trim().max(2000).optional(),
  })
  .optional();

export const nurseAdmReviewSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  outcome: z.enum(["endorse", "reject"]),
  clinicSession: clinicSessionSchema,

  referralForm: referralFormSchema,
});

export const nurseReferralFormSchema = z.object({
  recommendation: z.string().trim().min(1).max(500),
  referralForm: referralFormSchema,
  clinicSession: clinicSessionSchema,
});

export const sessionSchema = z.object({
  scheduledAt: z.string().min(1),
  sessionType: z.string().min(1),
  venue: z.string().trim().max(200).optional(),
});

export const completeSessionSchema = z.object({
  sessionNotes: z.string().trim().min(1).max(5000),
  outcome: z.string().trim().max(2000).optional(),
  followUpSession: z
    .object({
      scheduledAt: z.string().min(1),
      sessionType: z.string().min(1),
      venue: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const rescheduleSchema = z.object({
  scheduledAt: z.string().min(1),
});

export const cancelSessionSchema = z.object({
  cancelReason: z.string().trim().max(500).optional(),
});

export const adviserCancelSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const reopenSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]).optional(),
  consultReviewer: z.enum(["nurse", "guidance_counselor", "lrpc"]).optional(),
}).strict();
