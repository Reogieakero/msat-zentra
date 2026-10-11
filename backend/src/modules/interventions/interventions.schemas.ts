import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const startSchema = z.object({
  studentId: z.string().min(1).optional(),
  rosterId: z.string().min(1).optional(),
  recommendedAction: z.string().trim().min(1).max(2000),
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

export const interventionSessionSchema = z.object({
  scheduledAt: z.string().min(1),
  sessionType: z.string().min(1),
  venue: z.string().trim().max(200).optional(),
});

export const completeInterventionSessionSchema = z.object({
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

export const rescheduleInterventionSessionSchema = z.object({
  scheduledAt: z.string().min(1),
});

export const cancelInterventionSessionSchema = z.object({
  cancelReason: z.string().trim().max(500).optional(),
});

export const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "modified"]),
  recommendedAction: z.string().trim().max(2000).optional(),
});

export const assignSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

export const outcomeSchema = z.object({
  outcomeStatus: z.enum(["ongoing", "resolved", "unresolved"]),
  outcomeNotes: z.string().trim().max(2000).optional(),
});

/** Queue list-query validation: page/pageSize capped at 15, trimmed filters. */
export const interventionsQueueQuerySchema = paginationQuerySchema().extend({
  level: z.enum(["High", "Moderate", "All"]).optional(),
  factor: z.enum(["Academic", "Attendance", "Behavioral"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
  outcome: z.enum(["ongoing", "resolved", "unresolved", "all"]).optional(),
});
