export type AccessRequestStatus = "pending" | "approved" | "denied";

export type Sf10RecordStatus = "attach" | "available" | "released";

export type Sf10RecordDetail = {
  id: string;
  source: string;
  status: Sf10RecordStatus;
  fileUrl: string | null;
  verifiedAt: string | null;
  validatedAt: string | null;
  currentVersion: number;
};

export type Sf10RecordForAdvisee = {
  lrn: string;
  name: string;
  record: Sf10RecordDetail | null;
};

export type AffectedAdvisee = {
  lrn: string;
  name: string;
  gradeLevel: "G7" | "G8" | "G9" | "G10";
  section: string;
  sf10Status: "verified" | "validated" | "pending";
};

export type AdviserAccessRequest = {
  id: string;
  adviserId: string;
  adviserName: string;
  employeeId: string;
  section: string;
  gradeLevel: "G7" | "G8" | "G9" | "G10";
  reason: string;
  status: AccessRequestStatus;
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  affectedAdvisees: AffectedAdvisee[];
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
