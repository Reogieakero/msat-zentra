import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { MODULE_STATUSES } from "../teacher/advisory-modules.schemas.js";

/** Same "https only" rule as the adviser desk's module links. */
const answeredUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Link must start with http:// or https://",
  );

export const studentModulesQuerySchema = paginationQuerySchema().extend({
  status: z.enum(MODULE_STATUSES).optional(),
});

/** Learner pastes the answered module's link. */
export const studentLinkSubmissionSchema = z.object({
  submissionUrl: answeredUrlSchema,
  remarks: z.string().trim().max(1000).nullable().optional(),
});

/** Multipart upload: answered file (default) or proof of a physical hand-in. */
export const studentUploadSchema = z.object({
  kind: z.enum(["file", "physical"]).optional(),
  remarks: z.string().max(1000).optional(),
});
