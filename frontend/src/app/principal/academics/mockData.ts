export type RiskLevel = "High" | "Moderate" | "Low";
export type Remarks = "Passed" | "Failed";
export type SubjectStatus = "On Track" | "At Risk" | "Failing";

export function subjectStatus(grade: number): SubjectStatus {
  if (grade >= 85) return "On Track";
  if (grade >= 75) return "At Risk";
  return "Failing";
}

export interface StudentSubject {
  subject: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: Remarks;
}

export interface StudentRow {
  studentId: string;
  lrn: string;
  name: string;
  riskLevel: RiskLevel;
  overallAverage: number;
  attendanceRatePct: number;
  subjects: StudentSubject[];
}

export interface SectionSummary {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  passPct: number;
  failPct: number;
  atRiskCount: number;
  students: StudentRow[];
}

export interface PassFailByGrade {
  grade: string;
  passed: number;
  failed: number;
}

export type HonorRollTier = "Highest Honors" | "High Honors" | "With Honors";

export interface HonorRollCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
  tier: HonorRollTier;
}

export interface PotentialHonorCandidate {
  studentId: string;
  name: string;
  overallAverage: number;
  tier: HonorRollTier;
  unlockedSubjects: number;
}

export interface AcademicsMock {
  termLabel: string;
  sections: SectionSummary[];
  passFailByGrade: PassFailByGrade[];
  honorRollPreview: HonorRollCandidate[];
  potentialHonorRoll: PotentialHonorCandidate[];
}

export const termOptions = ["All Terms", "Term 1", "Term 2", "Term 3"] as const;
export const gradeOptions = [
  "All Grades",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;
export const sectionOptions = [
  "All Sections",
  "Section A",
  "Section B",
  "Section C",
] as const;
export const subjectOptions = [
  "All Subjects",
  "English",
  "Mathematics",
  "Science",
  "Filipino",
  "Araling Panlipunan",
  "TLE",
  "MAPEH",
] as const;

const SUBJECTS = [
  "English",
  "Mathematics",
  "Science",
  "Filipino",
  "Araling Panlipunan",
  "Edukasyon sa Pagpapakatao",
  "TLE",
  "MAPEH",
  "ICT",
];

export const SUBJECT_CODES: Record<string, string> = {
  English: "ENG",
  Mathematics: "MATH",
  Science: "SCI",
  Filipino: "FIL",
  "Araling Panlipunan": "AP",
  "Edukasyon sa Pagpapakatao": "ESP",
  TLE: "TLE",
  MAPEH: "MAP",
  ICT: "ICT",
};

export const subjectColumns: string[] = SUBJECTS;

function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildSubjects(rand: () => number, risk: RiskLevel): StudentSubject[] {
  return SUBJECTS.map((subject) => {
    const base =
      risk === "High" ? 74 + rand() * 12 : risk === "Moderate" ? 80 + rand() * 14 : 88 + rand() * 10;
    const computedAverage = Math.round(base * 10) / 10;
    const transmutedGrade = Math.min(98, Math.max(75, Math.round(computedAverage)));
    const remarks: Remarks = transmutedGrade >= 75 ? "Passed" : "Failed";
    return { subject, computedAverage, transmutedGrade, remarks };
  });
}

function buildStudents(
  seed: number,
  section: string,
  grade: string,
  count: number
): StudentRow[] {
  const rand = rng(seed);
  const students: StudentRow[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    const risk: RiskLevel = roll < 0.25 ? "High" : roll < 0.55 ? "Moderate" : "Low";
    const subjects = buildSubjects(rand, risk);
    const overallAverage =
      Math.round(
        (subjects.reduce((a, s) => a + s.computedAverage, 0) / subjects.length) * 10
      ) / 10;
    const attendanceRatePct = Math.round((risk === "High" ? 82 + rand() * 12 : 90 + rand() * 10) * 10) / 10;
    const lrnNum = 112233001000 + seed * 100 + i;
    students.push({
      studentId: `${grade}-${section}-${i + 1}`,
      lrn: `${lrnNum}`,
      name: `Student ${String.fromCharCode(65 + (i % 26))}${i + 1}`,
      riskLevel: risk,
      overallAverage,
      attendanceRatePct,
      subjects,
    });
  }
  return students;
}

function summarize(
  section: string,
  grade: string,
  seed: number,
  count: number
): SectionSummary {
  const students = buildStudents(seed, section, grade, count);
  const avgTransmuted =
    Math.round(
      (students.reduce((a, s) => a + s.overallAverage, 0) / students.length) * 10
    ) / 10;
  const failed = students.filter((s) => s.overallAverage < 75).length;
  const failPct = Math.round((failed / students.length) * 1000) / 10;
  const passPct = Math.round((100 - failPct) * 10) / 10;
  const atRiskCount = students.filter(
    (s) => s.riskLevel === "High" || s.riskLevel === "Moderate"
  ).length;
  return {
    sectionId: `${grade}-${section}`,
    section,
    grade,
    avgTransmuted,
    passPct,
    failPct,
    atRiskCount,
    students,
  };
}

const GRADES: string[] = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const SECTIONS = ["Section A", "Section B", "Section C"];

const sections: SectionSummary[] = [];
let seed = 7;
GRADES.forEach((grade, gi) => {
  SECTIONS.forEach((section, si) => {
    const count = 6 + ((gi + si) % 5);
    sections.push(summarize(section, grade, seed, count));
    seed += 13;
  });
});

const passFailByGrade: PassFailByGrade[] = GRADES.map((grade) => {
  const inGrade = sections.filter((s) => s.grade === grade);
  const passed = inGrade.reduce((a, s) => a + s.students.filter((st) => st.overallAverage >= 75).length, 0);
  const failed = inGrade.reduce((a, s) => a + s.students.filter((st) => st.overallAverage < 75).length, 0);
  return { grade, passed, failed };
});

function classifyHonorRoll(
  overallAverage: number,
  lowestSubject: number
): HonorRollTier | null {
  if (overallAverage >= 98 && lowestSubject >= 90) return "Highest Honors";
  if (overallAverage >= 95 && lowestSubject >= 85) return "High Honors";
  if (overallAverage >= 90 && lowestSubject >= 85) return "With Honors";
  return null;
}

const honorRollPreview: HonorRollCandidate[] = sections
  .flatMap((s) => s.students)
  .filter((st) => st.overallAverage >= 90 && st.riskLevel !== "High")
  .map((st) => ({
    student: st,
    tier: classifyHonorRoll(
      st.overallAverage,
      Math.min(...st.subjects.map((sub) => sub.transmutedGrade))
    ),
  }))
  .filter((x): x is { student: StudentRow; tier: HonorRollTier } => x.tier !== null)
  .sort((a, b) => {
    const rank: Record<HonorRollTier, number> = {
      "Highest Honors": 3,
      "High Honors": 2,
      "With Honors": 1,
    };
    const d = rank[b.tier] - rank[a.tier];
    if (d !== 0) return d;
    return b.student.overallAverage - a.student.overallAverage;
  })
  .slice(0, 12)
  .map((x) => ({
    studentId: x.student.studentId,
    name: x.student.name,
    overallAverage: x.student.overallAverage,
    tier: x.tier,
  }));

export const mockAcademics: AcademicsMock = {
  termLabel: "Term 3",
  sections,
  passFailByGrade,
  honorRollPreview,
  potentialHonorRoll: [],
};

export const MOCK: AcademicsMock = mockAcademics;
