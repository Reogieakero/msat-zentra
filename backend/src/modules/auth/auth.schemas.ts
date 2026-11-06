import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["student", "parent", "subject_teacher", "adviser"]),
  contactNumber: z.string().optional(),
  lrn: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["student", "staff", "parent"]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const approveSchema = z.object({ userId: z.string().min(1) });

export const rejectSchema = z.object({ reason: z.string().min(1) });

/** Pending-accounts list validation: page/pageSize capped at 15. */
export const pendingAccountsQuerySchema = paginationQuerySchema().extend({
  role: z.string().trim().max(40).optional(),
});
