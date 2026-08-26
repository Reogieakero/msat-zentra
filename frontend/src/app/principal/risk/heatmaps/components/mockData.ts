export type RiskLevelKey = "High" | "Moderate" | "Low";
export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface HeatmapData {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevelKey;
  factor: RiskFactor;
}

const SECTIONS: { id: string; section: string; grade: string }[] = [
  { id: "7-A", section: "Grade 7-A", grade: "7" },
  { id: "7-B", section: "Grade 7-B", grade: "7" },
  { id: "8-A", section: "Grade 8-A", grade: "8" },
  { id: "8-B", section: "Grade 8-B", grade: "8" },
  { id: "9-A", section: "Grade 9-A", grade: "9" },
  { id: "9-B", section: "Grade 9-B", grade: "9" },
  { id: "10-A", section: "Grade 10-A", grade: "10" },
  { id: "10-B", section: "Grade 10-B", grade: "10" },
  { id: "11-A", section: "Grade 11-A", grade: "11" },
  { id: "11-B", section: "Grade 11-B", grade: "11" },
  { id: "12-A", section: "Grade 12-A", grade: "12" },
  { id: "12-B", section: "Grade 12-B", grade: "12" },
];

export interface MenuSection {
  id: string;
  section: string;
  grade: string;
}

export function mockMenuSections(): MenuSection[] {
  return SECTIONS.map((s) => ({ id: s.id, section: s.section, grade: s.grade }));
}

function seeded(rowIdx: number, factorIdx: number): number {
  const base = [3, 9, 2, 6, 11, 4, 1, 8, 5, 0, 7, 2];
  const v = (base[rowIdx] + factorIdx * 2 + ((rowIdx * 7) % 5)) % 14;
  return v < 0 ? 0 : v;
}

export const mockHeatmap: HeatmapData = {
  termId: "term-1",
  factorTotals: { Academic: 47, Attendance: 63, Behavioral: 29 },
  sections: SECTIONS.map((s, i) => ({
    sectionId: s.id,
    section: s.section,
    gradeLevel: s.grade,
    factors: {
      Academic: seeded(i, 0),
      Attendance: seeded(i, 1),
      Behavioral: seeded(i, 2),
    },
  })),
};

const FIRST = [
  "Juan", "Maria", "Pedro", "Ana", "Carlos", "Sofia", "Luis", "Elena",
  "Marco", "Riza", "Paolo", "Grace", "James", "Bianca", "Ken", "Lara",
];
const LAST = [
  "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Torres", "Cruz",
  "Ramos", "Castillo", "Fernandez", "Gonzales", "Bautista", "Villanueva",
];

function nameAt(idx: number): string {
  return `${FIRST[idx % FIRST.length]} ${LAST[(idx * 3) % LAST.length]}`;
}

function lrnFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return String(100000000000 + (h % 899999999999)).padStart(12, "0");
}

export function mockSectionFactorStudents(
  sectionId: string,
  factor: RiskFactor
): HeatmapStudent[] {
  const section = mockHeatmap.sections.find((s) => s.sectionId === sectionId);
  const count = section ? section.factors[factor] : 0;
  return Array.from({ length: count }).map((_, i) => {
    const seed = `${sectionId}-${factor}-${i}`;
    const level: HeatmapStudent["riskLevel"] =
      factor === "Behavioral" && i % 4 === 0 ? "High" : "Moderate";
    return {
      lrn: lrnFor(seed),
      name: nameAt(i + sectionId.length),
      riskLevel: level,
      factor,
    };
  });
}

export function delay<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface AttendanceDay {
  date: string;
  isoDate: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
}

export interface SectionAttendance {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  days: AttendanceDay[];
}

// Deterministic per-section, per-session attendance for the term.
// Ratio drives the heat block color, matching the overview heatmap scale.
export function mockSectionAttendance(
  session: "AM" | "PM",
  days = 40
): SectionAttendance[] {
  const today = new Date("2026-08-25T00:00:00");
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return mockHeatmap.sections.map((s, idx) => {
    const enrolled = 28 + ((idx * 3) % 12);
    const baseRate =
      session === "AM"
        ? 0.96 - (idx % 5) * 0.04
        : 0.9 - (idx % 6) * 0.05;
    const daysData: AttendanceDay[] = dates.map((date, di) => {
      // Add gentle wave + occasional dip for realism.
      const wave = Math.sin((di + idx) / 5) * 0.05;
      const dip = (di + idx) % 17 === 0 ? -0.25 : 0;
      const rate = Math.max(0.4, Math.min(1, baseRate + wave + dip));
      const present = Math.round(enrolled * rate);
      const late = Math.round((enrolled - present) * 0.4);
      const excused = Math.round((enrolled - present) * 0.15);
      const absent = Math.max(0, enrolled - present - late - excused);
      return {
        date,
        isoDate: date,
        present,
        late,
        absent,
        excused,
        total: enrolled,
      };
    });
    return {
      sectionId: s.sectionId,
      section: s.section,
      gradeLevel: s.gradeLevel,
      enrolled,
      days: daysData,
    };
  });
}

export interface SectionAttendanceStat {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  rate: number; // 0..100
  belowDays: number; // days under 80%
  amRate: number; // 0..100
  pmRate: number; // 0..100
  trend: "up" | "down" | "flat";
}

function statFromSession(s: SectionAttendance, am: SectionAttendance, pm: SectionAttendance): SectionAttendanceStat {
  const present = s.days.reduce((a, d) => a + d.present, 0);
  const total = s.days.reduce((a, d) => a + d.total, 0);
  const rate = total > 0 ? (present / total) * 100 : 0;
  const belowDays = s.days.filter((d) => d.total > 0 && d.present / d.total < 0.8).length;

  const amPresent = am.days.reduce((a, d) => a + d.present, 0);
  const amTotal = am.days.reduce((a, d) => a + d.total, 0);
  const amRate = amTotal > 0 ? (amPresent / amTotal) * 100 : 0;

  const pmPresent = pm.days.reduce((a, d) => a + d.present, 0);
  const pmTotal = pm.days.reduce((a, d) => a + d.total, 0);
  const pmRate = pmTotal > 0 ? (pmPresent / pmTotal) * 100 : 0;

  const half = Math.floor(s.days.length / 2);
  const first = avg(s.days.slice(0, half));
  const second = avg(s.days.slice(half));
  const diff = second - first;
  const trend: SectionAttendanceStat["trend"] =
    diff > 1.5 ? "up" : diff < -1.5 ? "down" : "flat";

  return { sectionId: s.sectionId, section: s.section, gradeLevel: s.gradeLevel, enrolled: s.enrolled, rate: Math.round(rate * 10) / 10, belowDays, amRate: Math.round(amRate * 10) / 10, pmRate: Math.round(pmRate * 10) / 10, trend };
}

function avg(days: AttendanceDay[]): number {
  if (days.length === 0) return 0;
  const p = days.reduce((a, d) => a + d.present, 0);
  const t = days.reduce((a, d) => a + d.total, 0);
  return t > 0 ? (p / t) * 100 : 0;
}

export function mockSectionStats(): SectionAttendanceStat[] {
  const am = mockSectionAttendance("AM");
  const pm = mockSectionAttendance("PM");
  return am.map((s, i) => statFromSession(s, s, pm[i]));
}

export interface SessionPattern {
  amRate: number;
  pmRate: number;
  byDay: { day: string; rate: number }[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function mockSessionPattern(): SessionPattern {
  const am = mockSectionAttendance("AM");
  const pm = mockSectionAttendance("PM");
  const amRate = mean(am.map((s) => avg(s.days)));
  const pmRate = mean(pm.map((s) => avg(s.days)));

  // Day-of-week pattern: index each day by weekday across all sections.
  const buckets: Record<number, { p: number; t: number }> = {};
  for (const s of am) {
    for (const d of s.days) {
      const wd = new Date(d.date + "T00:00:00").getDay(); // 0 Sun..6 Sat
      if (wd === 0 || wd === 6) continue;
      const b = buckets[wd] ?? { p: 0, t: 0 };
      b.p += d.present;
      b.t += d.total;
      buckets[wd] = b;
    }
  }
  const byDay = DAY_NAMES.map((day, i) => {
    const wd = i + 1; // Mon=1
    const b = buckets[wd] ?? { p: 0, t: 0 };
    return { day, rate: b.t > 0 ? Math.round((b.p / b.t) * 1000) / 10 : 0 };
  });

  return {
    amRate: Math.round(amRate * 10) / 10,
    pmRate: Math.round(pmRate * 10) / 10,
    byDay,
  };
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export interface AcademicHeatmapCell {
  subject: string;
  below75Pct: number; // 0..100, % of section below passing for this subject
  below75Count: number;
  enrolled: number;
}

export interface AcademicHeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  cells: AcademicHeatmapCell[];
  anyAtRisk: boolean;
}

export interface AcademicHeatmapData {
  termId: string;
  subjects: string[];
  sections: AcademicHeatmapSection[];
  subjectTotals: { subject: string; below75Pct: number; below75Count: number }[];
}

const ACADEMIC_SUBJECTS = [
  "Math",
  "Science",
  "English",
  "Filipino",
  "AP",
  "TLE",
  "MAPEH",
  "Values",
];

// Deterministic section x subject failure matrix. Status-only: no student
// names, no LRNs — only aggregated below-75 percentages per cell.
export function mockAcademicHeatmap(): AcademicHeatmapData {
  const sections = mockHeatmap.sections;
  const data: AcademicHeatmapData = {
    termId: mockHeatmap.termId,
    subjects: ACADEMIC_SUBJECTS,
    sections: [],
    subjectTotals: [],
  };

  let subjectEnrolledSum: number[] = [];
  let subjectBelowSum: number[] = [];

  data.sections = sections.map((s, si) => {
    const enrolled = 28 + ((si * 3) % 12);
    const cells: AcademicHeatmapCell[] = ACADEMIC_SUBJECTS.map((subject, subj) => {
      // Subject difficulty bias + section variance, deterministic.
      const bias = [0.18, 0.22, 0.12, 0.1, 0.26, 0.15, 0.08, 0.09][subj % 8];
      const variance = ((si * 5 + subj * 3) % 11) / 100;
      const pct = Math.max(0, Math.min(0.6, bias + variance - (si % 4) * 0.02));
      const below75Count = Math.round(enrolled * pct);
      subjectEnrolledSum[subj] = (subjectEnrolledSum[subj] ?? 0) + enrolled;
      subjectBelowSum[subj] = (subjectBelowSum[subj] ?? 0) + below75Count;
      return {
        subject,
        below75Pct: Math.round(pct * 1000) / 10,
        below75Count,
        enrolled,
      };
    });
    return {
      sectionId: s.sectionId,
      section: s.section,
      gradeLevel: s.gradeLevel,
      cells,
      anyAtRisk: cells.some((c) => c.below75Count > 0),
    };
  });

  data.subjectTotals = ACADEMIC_SUBJECTS.map((subject, subj) => {
    const enrolled = subjectEnrolledSum[subj] ?? 0;
    const below = subjectBelowSum[subj] ?? 0;
    return {
      subject,
      below75Count: below,
      below75Pct: enrolled > 0 ? Math.round((below / enrolled) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.below75Pct - a.below75Pct);

  return data;
}

export interface TrendPoint {
  date: string;
  present: number; // school-wide present-student count for the session/date
}

// School-wide daily attendance trend (AM session) across all sections.
export function mockAttendanceTrend(): TrendPoint[] {
  const sections = mockSectionAttendance("AM");
  const len = sections[0]?.days.length ?? 0;
  const points: TrendPoint[] = [];
  for (let i = 0; i < len; i++) {
    let p = 0;
    let t = 0;
    for (const s of sections) {
      const d = s.days[i];
      p += d.present;
      t += d.total;
    }
    const date = sections[0].days[i].date;
    points.push({ date, present: p });
  }
  return points;
}


