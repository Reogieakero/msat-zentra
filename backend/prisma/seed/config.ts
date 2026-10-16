// ZENTRA school-scale seed — shared config (Term 1 complete + Term 2 partial to cutoff).
export const SY_NAME = "SY 2026-2027";
export const SY_START = new Date("2026-06-08T00:00:00Z");
export const SY_END = new Date("2027-04-08T00:00:00Z");

export const TERMS = [
  { n: 1, start: new Date("2026-06-08T00:00:00Z"), end: new Date("2026-09-15T00:00:00Z") },
  { n: 2, start: new Date("2026-09-16T00:00:00Z"), end: new Date("2026-12-18T00:00:00Z") },
  { n: 3, start: new Date("2027-01-04T00:00:00Z"), end: new Date("2027-04-08T00:00:00Z") },
] as const;

// Ongoing-term cutoff: seed Term 2 only up to this date (today).
export const T2_CUTOFF = new Date("2026-10-11T23:59:59Z");

// PH holidays inside our window (attendance excluded).
export const HOLIDAYS = new Set(["2026-06-12", "2026-08-21", "2026-08-25"]);

export type SizeMode = "small" | "full";
const argSize: SizeMode | null = process.argv.includes("--small") ? "small" : process.argv.includes("--full") ? "full" : null;
export const SIZE: SizeMode = argSize ?? ((process.env.SEED_SIZE as SizeMode) === "small" ? "small" : "full");
export const SEED = Number(process.env.SEED ?? 20261011) || 20261011;
export const DRY = process.argv.includes("--dry-run");
export const WIPE = process.env.SEED_WIPE === "1";

// Section plan: grade -> {count, size range}. Full = 52 sections ~1,950. Small = 18 sections (3/grade x 10) = 180.
export const SECTION_PLAN: Record<string, { count: number; min: number; max: number }> =
  SIZE === "full"
    ? {
        G7: { count: 9, min: 35, max: 40 },
        G8: { count: 9, min: 35, max: 40 },
        G9: { count: 9, min: 35, max: 40 },
        G10: { count: 9, min: 35, max: 40 },
        G11: { count: 8, min: 36, max: 42 },
        G12: { count: 8, min: 36, max: 42 },
      }
    : {
        G7: { count: 3, min: 10, max: 10 },
        G8: { count: 3, min: 10, max: 10 },
        G9: { count: 3, min: 10, max: 10 },
        G10: { count: 3, min: 10, max: 10 },
        G11: { count: 3, min: 10, max: 10 },
        G12: { count: 3, min: 10, max: 10 },
      };

// Subject catalog per grade.
export const SUBJECTS: Record<string, { name: string; code: string }[]> = {
  G7: [
    { name: "Mathematics 7", code: "MATH7" },
    { name: "English 7", code: "ENG7" },
    { name: "Science 7", code: "SCI7" },
    { name: "Filipino 7", code: "FIL7" },
    { name: "Araling Panlipunan 7", code: "AP7" },
    { name: "Edukasyon sa Pagpapakatao 7", code: "ESP7" },
    { name: "MAPEH 7", code: "MAPEH7" },
    { name: "TLE 7", code: "TLE7" },
  ],
  G8: [
    { name: "Mathematics 8", code: "MATH8" },
    { name: "English 8", code: "ENG8" },
    { name: "Science 8", code: "SCI8" },
    { name: "Filipino 8", code: "FIL8" },
    { name: "Araling Panlipunan 8", code: "AP8" },
    { name: "Edukasyon sa Pagpapakatao 8", code: "ESP8" },
    { name: "MAPEH 8", code: "MAPEH8" },
    { name: "TLE 8", code: "TLE8" },
  ],
  G9: [
    { name: "Mathematics 9", code: "MATH9" },
    { name: "English 9", code: "ENG9" },
    { name: "Science 9", code: "SCI9" },
    { name: "Filipino 9", code: "FIL9" },
    { name: "Araling Panlipunan 9", code: "AP9" },
    { name: "Edukasyon sa Pagpapakatao 9", code: "ESP9" },
    { name: "MAPEH 9", code: "MAPEH9" },
    { name: "TLE 9", code: "TLE9" },
  ],
  G10: [
    { name: "Mathematics 10", code: "MATH10" },
    { name: "English 10", code: "ENG10" },
    { name: "Science 10", code: "SCI10" },
    { name: "Filipino 10", code: "FIL10" },
    { name: "Araling Panlipunan 10", code: "AP10" },
    { name: "Edukasyon sa Pagpapakatao 10", code: "ESP10" },
    { name: "MAPEH 10", code: "MAPEH10" },
    { name: "TLE 10", code: "TLE10" },
  ],
  G11: [
    { name: "General Mathematics 11", code: "GMM11" },
    { name: "Purposive Communication 11", code: "PC11" },
    { name: "Earth Science 11", code: "ES11" },
    { name: "Komunikasyon 11", code: "FIL11" },
    { name: "PE and Health 11", code: "PEH11" },
    { name: "Practical Research 1", code: "PR111" },
  ],
  G12: [
    { name: "Basic Calculus 12", code: "CALC12" },
    { name: "Practical Research 2", code: "RES12" },
    { name: "Physics 12", code: "PHY12" },
    { name: "Filipino 12", code: "FIL12" },
    { name: "Contemporary Arts 12", code: "ARTS12" },
    { name: "Entrepreneurship 12", code: "ENTREP12" },
  ],
};

// DepEd weights per subject.
export function weightsFor(grade: string, code: string): { WW: number; PT: number; EXAM: number } {
  if (grade === "G11" || grade === "G12") return { WW: 25, PT: 45, EXAM: 30 };
  if (/^(MATH|SCI)/.test(code)) return { WW: 40, PT: 40, EXAM: 20 };
  if (/^(MAPEH|TLE)/.test(code)) return { WW: 20, PT: 60, EXAM: 20 };
  return { WW: 30, PT: 50, EXAM: 20 };
}

// Assessments per component.
export const ASM_PER_COMPONENT =
  SIZE === "full"
    ? { WRITTEN_WORK: 3, PERFORMANCE_TASK: 3, EXAM: 1 }
    : { WRITTEN_WORK: 2, PERFORMANCE_TASK: 2, EXAM: 1 };

export const SUBJECTS_PER_DAY = SIZE === "full" ? 4 : 1;

// Attendance day cap for small seeds (most recent school days per term).
// Full term = T1 ~69 days + T2 partial ~18 days; small keeps 10 + 10.
export const ATTENDANCE_DAYS_PER_TERM = SIZE === "full" ? Infinity : 10;

export const STAFF_PASSWORD = "Zentra2025!";
export const STUDENT_PASSWORD = "Student2025!";
export const PARENT_PASSWORD = "Parent2025!";
