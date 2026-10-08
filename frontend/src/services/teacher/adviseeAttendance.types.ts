export interface SubjectMark {
  status: string;
  slot: number;
  name: string;
  code: string;
}

export interface AttendanceDay {
  date: string;
  sessions: Record<string, string>;
  subjects?: Record<string, SubjectMark>;
}

export interface SubjectBreakdown {
  subjectId: string;
  name: string;
  code: string;
  present: number;
  total: number;
  rate: number;
}

export interface SubjectAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
  isRisk: boolean;
  bySubject: SubjectBreakdown[];
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  schoolDays: number;
  rate: number;
  isRisk: boolean;
}

export interface StudentAttendance {
  student: {
    studentId: string;
    name: string;
    lrn: string;
    section: string;
  };
  summary: AttendanceSummary;

  subjectSummary: SubjectAttendanceSummary | null;
  termStart: string | null;
  days: AttendanceDay[];
}
