export type StudentStatus = "Active" | "Transferred" | "Inactive" | "New";

// Mirrors the backend AnecdotalCategory enum.
export type BehavioralCategory = "behavioral" | "bullying" | "academic" | "attendance" | "health";

export interface BehavioralRecord {
  id: string;
  date: string;
  category: BehavioralCategory;
  description: string;
  severity: "Low" | "Moderate" | "High";
  staff: string;
  resolution: string;
  followUp: "Pending" | "Resolved" | "Monitoring";
}

export interface AcademicRecord {
  averageGrade: string;
  sf10Status: "Complete" | "Incomplete" | "Missing";
  missingRecords: string[];
  completion: number;
}

export interface RecordStudent {
  lrn: string;
  name: string;
  status: StudentStatus;
  gradeLevel: string;
  section: string;
  sectionId: string;
  academic: AcademicRecord;
  behavioral: BehavioralRecord[];
}

export interface RecordSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  students: RecordStudent[];
}

export interface RecordDataset {
  schoolYear: string;
  sections: RecordSection[];
}

const GRADES = ["7", "8", "9", "10", "11", "12"];
const SECTION_LETTERS = ["A", "B"];

const FIRST = [
  "Maria", "John", "Sofia", "Liam", "Ana", "Gabriel", "Riza", "Mark",
  "Ella", "Paolo", "Nina", "Carlos", "Joy", "Adrian", "Bea", "Marco",
  "Cris", "Lara", "Ken", "Mae",
];
const LAST = [
  "Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Ramos",
  "Castillo", "Rivera", "Flores", "Gonzales", "Bautista", "Delos Reyes",
  "Villanueva", "Navarro",
];

const CATEGORIES: BehavioralRecord["category"][] = [
  "behavioral", "bullying", "academic", "attendance", "health",
];
const SEVERITIES: BehavioralRecord["severity"][] = ["Low", "Moderate", "High"];
const FOLLOW: BehavioralRecord["followUp"][] = ["Pending", "Resolved", "Monitoring"];

function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function buildStudents(sectionId: string, grade: string, letter: string, idx: number): RecordStudent[] {
  const count = 12 + Math.floor(seeded(idx) * 8);
  const students: RecordStudent[] = [];
  for (let i = 0; i < count; i++) {
    const n = idx * 100 + i;
    const lrn = `10${(2023000 + n).toString()}`;
    const name = `${FIRST[(n + 3) % FIRST.length]} ${LAST[(n + 7) % LAST.length]}`;
    const statusRoll = seeded(n * 2);
    const status: StudentStatus =
      statusRoll > 0.92 ? "Transferred" : statusRoll > 0.85 ? "Inactive" : statusRoll > 0.78 ? "New" : "Active";
    const behavioralCount = 1 + Math.floor(seeded(n * 3) * 4);
    const behavioral: BehavioralRecord[] = Array.from({ length: behavioralCount }).map((_, b) => {
      const bn = n * 10 + b;
      const day = 1 + Math.floor(seeded(bn) * 27);
      const month = 1 + Math.floor(seeded(bn * 2) * 6);
      return {
        id: `${lrn}-b${b}`,
        date: `2026-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
        category: CATEGORIES[(bn + b) % CATEGORIES.length],
        description:
          b % 3 === 0
            ? "Late arrival pattern noted during morning routine."
            : b % 3 === 1
              ? "Peer conflict mediated by guidance counselor."
              : "Positive participation recognized in class.",
        severity: SEVERITIES[(bn + 1) % SEVERITIES.length],
        staff: `Mr. ${LAST[(bn + 2) % LAST.length]}`,
        resolution: b % 2 === 0 ? "Parent notified; action plan discussed." : "Documented and monitored.",
        followUp: FOLLOW[(bn + b) % FOLLOW.length],
      };
    });
    const completion = 60 + Math.floor(seeded(n * 5) * 40);
    const missing: string[] =
      completion < 90
        ? ["SF10 form", "Medical cert", "Guardian contact"].slice(0, Math.max(0, 3 - Math.floor(completion / 35)))
        : [];
    students.push({
      lrn,
      name,
      status,
      gradeLevel: grade,
      section: `Grade ${grade}-${letter}`,
      sectionId,
      academic: {
        averageGrade: (75 + seeded(n * 7) * 23).toFixed(1),
        sf10Status: completion >= 95 ? "Complete" : completion >= 80 ? "Incomplete" : "Missing",
        missingRecords: missing,
        completion,
      },
      behavioral,
    });
  }
  return students;
}

export const mockRecords: RecordDataset = {
  schoolYear: "2026–2027",
  sections: GRADES.flatMap((grade) =>
    SECTION_LETTERS.map((letter, li) => {
      const sectionId = `${grade}-${letter}`;
      const idx = Number(grade) * 2 + li;
      return {
        sectionId,
        section: `Grade ${grade}-${letter}`,
        gradeLevel: grade,
        students: buildStudents(sectionId, grade, letter, idx),
      };
    })
  ),
};

export function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
