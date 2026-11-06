import type { GradeLevel } from "../generated/prisma/client.js";

export interface BaseContext {
  userId: string;
  role: string;
  termId: string | null;
}

export interface ScopedContext extends BaseContext {
  schoolYearId: string | null;
}

export interface RegistryContext {
  userId: string;
  role: string;
  band: GradeLevel[];
}

export interface DeskIdentity {
  deskNoun: string;
  scopeNoun: string;
  employeePrefix: string;
}

export type AdmContext = BaseContext;
export type AnecdotalContext = BaseContext;
export type InterventionContext = BaseContext;
export type ReferralContext = BaseContext;
export type AdvisoryContext = ScopedContext;
export type AttendanceContext = ScopedContext;
export type GuidanceContext = ScopedContext;
export type TeacherContext = ScopedContext;

export interface AuthContext {
  userId: string;
  role: string;
}

export type Sf10Context = AuthContext;
