import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

/**
 * Philippine mobile number: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX.
 * Spaces/hyphens are stripped before matching so users can type
 * "0917-123-4567" or "+63 917 123 4567".
 */
export const PH_MOBILE_PATTERN = /^(?:\+63|0)9\d{9}$/;

const contactNumberField = z
  .string()
  .trim()
  .max(30)
  .optional()
  .refine((value) => !value || PH_MOBILE_PATTERN.test(value.replace(/[\s-]/g, "")), {
    message: "Enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).",
  });

/** Name extension (Jr., Sr., II, III, …). */
const suffixField = z.string().trim().max(10).optional();

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  suffix: suffixField,
  role: z.enum(["student", "parent", "subject_teacher", "adviser"]),
  contactNumber: contactNumberField,
  lrn: z.string().optional(),
  employeeId: z.string().trim().max(40).optional(),
  department: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["student", "staff", "parent", "admin"]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const approveSchema = z.object({ userId: z.string().min(1) });

export const rejectSchema = z.object({ reason: z.string().min(1) });

/** Google flows: the browser posts the Supabase access token it obtained. */
export const googleExchangeSchema = z.object({
  supabaseAccessToken: z.string().min(1),
  role: z.enum(["student", "parent", "staff"]),
  // Sign-in never creates accounts; only an explicit sign-up does.
  intent: z.enum(["login", "signup"]).optional().default("login"),
});

export const googleCompleteSchema = z.object({
  supabaseAccessToken: z.string().min(1),
  lrn: z.string().trim().min(1).max(20),
  contactNumber: z.string().trim().max(30).optional(),
});

/** Second half of a Google teacher sign-up (personal details). */
export const googleCompleteStaffSchema = z.object({
  supabaseAccessToken: z.string().min(1),
  fullName: z.string().trim().min(1).max(120),
  suffix: suffixField,
  contactNumber: contactNumberField,
  employeeId: z.string().trim().max(40).optional(),
  department: z.string().trim().max(80).optional(),
});

/** Pending-accounts list validation: page/pageSize capped at 15. */
export const pendingAccountsQuerySchema = paginationQuerySchema().extend({
  role: z.string().trim().max(40).optional(),
});
