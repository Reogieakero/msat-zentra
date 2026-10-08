export interface TeacherClassRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  studentCount: number;
}

export interface TeacherKpiRow {
  classCount: number;
  pendingAssessments: number;
  openFlags: number;
  studentCount: number;
}

export interface TeacherActivityRow {
  action: string;
  target: string;
  when: string;
}

export interface AdvisoryStatusRow {
  studentId: string;
  name: string;
  lrn: string;
  section: string;
  riskLevel: "Low" | "Moderate" | "High";
  flag: "academic" | "attendance" | "behavioral" | "none";
  flags: ("academic" | "attendance" | "behavioral")[];
}

export interface SubjectAssessmentRow {
  id: string;
  subject: string;
  gradeLevel: string;
  section: string;
  type: "WW" | "PT" | "E";
  title: string;
  dueDate: string;
  status: string;
}

export interface ClassAverageRow {
  subject: string;
  gradeLevel: string;
  section: string;
  average: number;
  assessed: number;
  students: number;
}

export interface AdvisorySectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

export interface ClassStudentRow {
  studentId: string;
  name: string;
  lrn: string;
  sectionId: string;
  section: string;

  subjects: string[];
  riskLevel: "Low" | "Moderate" | "High";

  flags: ("academic" | "attendance")[];
}

export interface TeacherOverviewData {
  teacherName: string;
  isAdviser: boolean;
  isMasterTeacher: boolean;
  masterTeacherEligible: boolean;
  masterTeacherTaken: boolean;
  masterTeacherHolderName: string | null;
  advisorySection: AdvisorySectionInfo | null;
  kpi: TeacherKpiRow;
  atRiskFactors: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  atRiskStudents: number;
  classes: TeacherClassRow[];
  classStudents: ClassStudentRow[];
  recentActivity: TeacherActivityRow[];
  advisory: {
    students: AdvisoryStatusRow[];
  };
  subjectClasses: {
    assessments: SubjectAssessmentRow[];
    standings: ClassAverageRow[];
  };
}

export interface TeacherOverviewCritical {
  teacherName: string;
  isAdviser: boolean;
  isMasterTeacher: boolean;
  masterTeacherEligible: boolean;
  masterTeacherTaken: boolean;
  masterTeacherHolderName: string | null;
  advisorySection: AdvisorySectionInfo | null;
  kpi: TeacherKpiRow;
  atRiskFactors: {
    academic: number;
    attendance: number;
    behavioral: number;
  };
  atRiskStudents: number;
  classes: TeacherClassRow[];
  classStudents: ClassStudentRow[];
  advisory: {
    students: AdvisoryStatusRow[];
  };
}

export interface TeacherOverviewSecondary {
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
  recentActivity: TeacherActivityRow[];
  pendingAssessments: number;
  openFlags: number;
}

export interface TeacherOverviewGradebook {
  classes: TeacherClassRow[];
  assessments: SubjectAssessmentRow[];
  standings: ClassAverageRow[];
}
