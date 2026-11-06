import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

/** Google Drive (or any https) link to a module file or an answered module. */
const moduleUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value === "" || /^https?:\/\//i.test(value),
    "Link must start with http:// or https://",
  );

export const MODULE_STATUSES = ["submitted", "pending", "overdue"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const advisoryModulesQuerySchema = paginationQuerySchema().extend({
  sectionId: z.string().trim().max(64).optional(),
  status: z.enum(MODULE_STATUSES).optional(),
});

export const advisorySubmissionsQuerySchema = paginationQuerySchema().extend({
  status: z.enum(MODULE_STATUSES).optional(),
});

export const advisoryModuleCreateSchema = z.object({
  sectionId: z.string().trim().min(1).max(64).optional(),
  kind: z.enum(["general", "adm"]).optional(),
  moduleName: z.string().trim().min(1).max(120),
  moduleUrl: moduleUrlSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const advisoryModuleUpdateSchema = z.object({
  moduleName: z.string().trim().min(1).max(120).optional(),
  moduleUrl: moduleUrlSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const advisorySubmissionKindSchema = z.enum(["link", "file", "physical"]);

/** Exactly one learner is targeted: an account (studentId) or a roster row. */
export const advisorySubmissionSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    rosterId: z.string().uuid().optional(),
    submissionKind: advisorySubmissionKindSchema.optional(),
    submissionUrl: moduleUrlSchema.nullable().optional(),
    submitted: z.boolean().optional(),
    remarks: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (value) => Boolean(value.studentId) !== Boolean(value.rosterId),
    "Provide exactly one of studentId or rosterId",
  );
