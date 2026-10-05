"use client";

/* Referral taxonomy — exactly 2 types. ADM cases flow through the ADM
   workflow; everything else is Other matters, received by staff directly:
   guidance means counseling, the school nurse means clinical matters. No
   principal routing — the staff who receive a file are guidance or nurse
   (plus LRPC as an ADM reviewer). */

export type ReferralDesk =
  | "nurse"
  | "guidance_counselor"
  | "adm_coordinator"
  | "principal";

export type ReferralTypeKey = "adm" | "other";

export interface ReferralTypeMeta {
  key: ReferralTypeKey;
  label: string;
  hint: string;
  badgeVariant: "amber" | "blue";
}

export const REFERRAL_TYPES: ReferralTypeMeta[] = [
  {
    key: "adm",
    label: "ADM case",
    hint: "Discipline cases via the ADM workflow.",
    badgeVariant: "amber",
  },
  {
    key: "other",
    label: "Other matters",
    hint: "Counseling or clinical matters.",
    badgeVariant: "blue",
  },
];

export function typeForDesk(desk: string): ReferralTypeMeta {
  return desk === "adm_coordinator" ? REFERRAL_TYPES[0]! : REFERRAL_TYPES[1]!;
}

export type AdmReviewer = "nurse" | "guidance_counselor" | "lrpc";

export interface StaffOption {
  value: string;
  label: string;
  hint: string;
  desk: ReferralDesk;
  reviewer: AdmReviewer | null;
}

/* Who receives the file, grouped by type. ADM reviewers route through the
   ADM Coordinator; other matters go straight to the desk. */
export const STAFF_BY_TYPE: Record<ReferralTypeKey, StaffOption[]> = {
  adm: [
    { value: "adm:nurse", label: "School Nurse", hint: "ADM review", desk: "adm_coordinator", reviewer: "nurse" },
    { value: "adm:guidance_counselor", label: "Guidance Counselor", hint: "ADM review", desk: "adm_coordinator", reviewer: "guidance_counselor" },
    { value: "adm:lrpc", label: "LRPC", hint: "ADM review", desk: "adm_coordinator", reviewer: "lrpc" },
  ],
  other: [
    { value: "other:guidance_counselor", label: "Guidance Counselor", hint: "Counseling", desk: "guidance_counselor", reviewer: null },
    { value: "other:nurse", label: "School Nurse", hint: "Clinical", desk: "nurse", reviewer: null },
  ],
};

export function findStaff(value: string): StaffOption | null {
  for (const list of Object.values(STAFF_BY_TYPE)) {
    const hit = (list as StaffOption[]).find((o) => o.value === value);
    if (hit) return hit;
  }
  return null;
}

export const DESK_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

function reviewerLabel(value: string | null): string {
  if (value === "nurse") return "School Nurse";
  if (value === "guidance_counselor") return "Guidance Counselor";
  if (value === "lrpc") return "LRPC";
  return "ADM queue";
}

/* Where the file lands: the desk itself, or — for ADM cases with a nurse /
   guidance reviewer — the reviewer first, moving to the ADM Coordinator
   only on endorsement. (lrpc has no reviewer step, so it stays direct.) */
export function filedToLabel(opt: StaffOption): string {
  if (opt.desk !== "adm_coordinator") return opt.label;
  if (!opt.reviewer) return "ADM Coordinator";
  if (opt.reviewer === "lrpc") return `ADM Coordinator · ${reviewerLabel(opt.reviewer)}`;
  return `${reviewerLabel(opt.reviewer)} — moves to ADM Coordinator on endorsement`;
}
