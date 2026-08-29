export type Sf10Attach = {
  student: string;
  lrn: string;
  grade: string;
  when: string; // ISO timestamp — formatted relative on display
};

export type Sf10Missing = {
  student: string;
  lrn: string;
  grade: string;
};

export type PendingStudent = {
  name: string;
  lrn: string;
  grade: string;
  parent: string;
};

export type Sf10Student = {
  name: string;
  lrn: string;
  grade: string;
};

export type RegistrarOverviewData = {
  pendingAccounts: number;
  pendingAdviserAccess: number;
  lockedFinalsAwaiting: number;
  sf10Released: number;
  sections: number;
  subjects: number;
  reportCards: number;
  latestAttachments: Sf10Attach[];
  missingSf10: Sf10Missing[];
  pendingStudents: PendingStudent[];
  sf10Students: Sf10Student[];
};

function formatRelativeTime(iso: string): string {
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

export { formatRelativeTime };
