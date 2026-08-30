export type StudentApprovalStatus = "pending" | "active" | "suspended";

export type AccountBreakdown = {
  id: string;
  label: string;
  withAccount: number;
  pending: number;
};

export type LrnMatchResult = {
  claimedLrn: string;
  found: boolean;
  roster?: {
    lrn: string;
    fullName: string;
    gradeLevel: string;
    section: string | null;
  };
  lrnMatch: boolean;
  nameSimilarity: number;
  nameMatch: boolean;
  verdict: "match" | "mismatch" | "not_found";
};

export type PendingStudent = {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: "G7" | "G8" | "G9" | "G10" | "G11" | "G12" | "—";
  section: string;
  email: string;
  contactNumber: string;
  birthdate: string;
  address: string;
  imageUrl: string | null;
  status: StudentApprovalStatus;
  requestedAt: string; // ISO timestamp
};

export type PendingStudentsResponse = {
  students: PendingStudent[];
};

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
