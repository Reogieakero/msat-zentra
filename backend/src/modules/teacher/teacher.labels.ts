import { GRADE_LABELS, gradeToNumber as gradeToNumberCore } from "../../lib/grades.js";

export { GRADE_LABELS };

export const COMPONENT_TYPE_LABEL: Record<string, "WW" | "PT" | "E"> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

export const ACTION_LABEL: Record<string, string> = {
  grade_lock: "Locked grades",
  grade_unlock: "Unlocked grades",
  anecdotal_edit: "Logged anecdotal",
  referral_status_change: "Updated referral",
  create: "Created record",
  update: "Updated record",
};

export function gradeToNumber(gradeLevel: string | number): number {
  if (typeof gradeLevel === "number") return gradeLevel;
  return gradeToNumberCore(gradeLevel);
}

export const EMPTY_RESPONSE = {  teacherName: "",
  isAdviser: false,
  isMasterTeacher: false,
  masterTeacherEligible: false,
  masterTeacherTaken: false,
  masterTeacherHolderName: null as string | null,
  advisorySection: null,
  kpi: { classCount: 0, pendingAssessments: 0, openFlags: 0, studentCount: 0 },
  atRiskFactors: { academic: 0, attendance: 0, behavioral: 0 },
  atRiskStudents: 0,
  classes: [],
  classStudents: [],
  recentActivity: [],
  advisory: { students: [] },
  subjectClasses: { assessments: [], standings: [] },
};

export const SCHEDULE_CONFIG_DEFAULTS = {
  startTime: "07:30",
  periodMins: 60,
  lunch: { afterPeriod: 4, mins: 90 },
  morningRecess: { enabled: false, afterPeriod: 2, mins: 15 },
  afternoonRecess: { enabled: false, afterPeriod: 6, mins: 15 },
};

export function toScheduleConfig(row: {
  startTime: string;
  periodMins: number;
  lunchAfter: number;
  lunchMins: number;
  recessAmOn: boolean;
  recessAmAfter: number;
  recessAmMins: number;
  recessPmOn: boolean;
  recessPmAfter: number;
  recessPmMins: number;
}) {
  return {
    startTime: row.startTime,
    periodMins: row.periodMins,
    lunch: { afterPeriod: row.lunchAfter, mins: row.lunchMins },
    morningRecess: { enabled: row.recessAmOn, afterPeriod: row.recessAmAfter, mins: row.recessAmMins },
    afternoonRecess: { enabled: row.recessPmOn, afterPeriod: row.recessPmAfter, mins: row.recessPmMins },
  };
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toISOString().slice(0, 10);
}
