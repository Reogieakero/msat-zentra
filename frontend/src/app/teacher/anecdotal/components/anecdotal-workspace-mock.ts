export type MockAnecdotalCategory =
  | "behavioral"
  | "bullying"
  | "academic"
  | "attendance"
  | "health";

export interface MockFollowup {
  id: string;
  by: string;
  date: string;
  notes: string;
}

export interface MockAnecdotalRecord {
  id: string;
  studentId: string;
  studentName: string;
  observationDate: string;
  category: MockAnecdotalCategory;
  tier: "Restricted" | "Confidential";
  location: string;
  incident: string;
  notes: string;
  followups: MockFollowup[];
  referred: boolean;
  referralTarget?: string;
}

export interface MockAnecdotalStudent {
  id: string;
  name: string;
  lrn: string;
}

// Mock only — anecdotal workspace exploration. No backend wiring.
export const MOCK_ANECDOTAL_STUDENTS: MockAnecdotalStudent[] = [
  { id: "stu-1", name: "Maria Santos", lrn: "201234567801" },
  { id: "stu-2", name: "Juan Cruz", lrn: "201234567802" },
  { id: "stu-3", name: "Ana Reyes", lrn: "201234567803" },
  { id: "stu-4", name: "Pedro Garcia", lrn: "201234567804" },
  { id: "stu-5", name: "Sofia Mendoza", lrn: "201234567805" },
  { id: "stu-6", name: "Rosa Diaz", lrn: "201234567806" },
];

export const CATEGORY_COLORS: Record<MockAnecdotalCategory, string> = {
  behavioral: "#166534",
  bullying: "#b91c1c",
  academic: "#1d4ed8",
  attendance: "#c2410c",
  health: "#7c3aed",
};

export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const MOCK_ANECDOTAL_RECORDS: MockAnecdotalRecord[] = [
  {
    id: "anec-1",
    studentId: "stu-3",
    studentName: "Ana Reyes",
    observationDate: "Sep 2, 2026",
    category: "behavioral",
    tier: "Confidential",
    location: "Classroom",
    incident: "Disruptive behavior during class discussion — repeatedly talked over the lesson even after two warnings.",
    notes: "Monitor and counsel. Parent meeting recommended if it repeats this week.",
    followups: [
      { id: "af-1", by: "Adviser G7-A", date: "Sep 3, 2026", notes: "One-on-one talk held. Student apologized and committed to participate properly." },
    ],
    referred: true,
    referralTarget: "Guidance Counselor",
  },
  {
    id: "anec-2",
    studentId: "stu-2",
    studentName: "Juan Cruz",
    observationDate: "Aug 30, 2026",
    category: "academic",
    tier: "Restricted",
    location: "Classroom",
    incident: "Late submission of assignments for three consecutive days without prior notice.",
    notes: "Check for underlying issues at home. Give a catch-up plan.",
    followups: [],
    referred: false,
  },
  {
    id: "anec-3",
    studentId: "stu-6",
    studentName: "Rosa Diaz",
    observationDate: "Aug 28, 2026",
    category: "attendance",
    tier: "Restricted",
    location: "Gate",
    incident: "Arrived 45 minutes late twice this week. No excuse letter presented.",
    notes: "Reminded of the tardiness policy. Notify parent on next occurrence.",
    followups: [
      { id: "af-2", by: "Adviser G7-A", date: "Aug 29, 2026", notes: "Parent called. Cited transport problems; monitoring." },
    ],
    referred: false,
  },
  {
    id: "anec-4",
    studentId: "stu-5",
    studentName: "Sofia Mendoza",
    observationDate: "Aug 25, 2026",
    category: "behavioral",
    tier: "Restricted",
    location: "Classroom",
    incident: "Verbal altercation with a classmate during group activity.",
    notes: "Both parties reconciled. Resolved at the classroom level.",
    followups: [],
    referred: false,
  },
  {
    id: "anec-5",
    studentId: "stu-3",
    studentName: "Ana Reyes",
    observationDate: "Aug 21, 2026",
    category: "academic",
    tier: "Restricted",
    location: "Classroom",
    incident: "Incomplete homework without prior notice for the second time.",
    notes: "Coordinated with subject teacher for remedial work.",
    followups: [],
    referred: false,
  },
  {
    id: "anec-6",
    studentId: "stu-4",
    studentName: "Pedro Garcia",
    observationDate: "Aug 18, 2026",
    category: "health",
    tier: "Confidential",
    location: "Clinic",
    incident: "Student felt dizzy during flag ceremony and was brought to the clinic.",
    notes: "Advised rest and hydration. Referred to the school nurse for monitoring.",
    followups: [],
    referred: true,
    referralTarget: "Nurse",
  },
];
