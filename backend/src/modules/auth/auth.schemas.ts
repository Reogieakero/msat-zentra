import { z } from "zod";

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
