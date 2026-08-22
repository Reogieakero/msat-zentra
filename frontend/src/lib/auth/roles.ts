export const ROLES = [
  "student",
  "parent",
  "subject_teacher",
  "adviser",
  "nurse",
  "adm_coordinator",
  "guidance_counselor",
  "record_keeper",
  "registrar",
  "principal",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  parent: "Parent / Guardian",
  subject_teacher: "Subject Teacher",
  adviser: "Adviser",
  nurse: "School Nurse",
  adm_coordinator: "ADM Coordinator",
  guidance_counselor: "Guidance Counselor",
  record_keeper: "Record Keeper",
  registrar: "Registrar",
  principal: "Principal",
};

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}
