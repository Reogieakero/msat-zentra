export type ComponentType = "WRITTEN_WORK" | "PERFORMANCE_TASK" | "EXAM";

export interface ClassAssignment {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectCategory: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
  termId: string;
  termNumber: number;
  schoolYear: string;
}

export interface ClassFinal {
  id: string;
  studentId: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: string | null;
  lockStatus: string | null;
}

export interface ClassStudent {
  id: string;
  name: string;
  lrn: string;
  hasAccount: boolean;
  final: ClassFinal | null;
}

export interface ClassAssessment {
  id: string;
  title: string;
  maxScore: number;
  dateGiven: string;
  createdAt: string;
  scores: Record<string, number>;
}

export interface ClassComponent {
  id: string;
  type: ComponentType;
  label: string;
  weight: number;
  assessments: ClassAssessment[];
}

export interface ClassDetail {
  assignment: ClassAssignment;
  students: ClassStudent[];
  components: ClassComponent[];
}

export type WeightPreset = "SHS" | "JHS_LANG" | "JHS_MATH_SCI" | "JHS_MAPEH_TLE";

export interface ScoreResult {
  computedAverage: number;
  transmutedGrade: number;
  remarks: string;
}

export interface TransmutationBand {
  grade: number;
  low: number;
  high: number;
}

export type CategoryEvidence = {
  componentType: string;
  weightPercentage: number;
  earned: number;
  possible: number;
  assessmentCount: number;
  encodedCount: number;
};

export type CategoryResult = {
  componentType: string;
  assessmentCount: number;
  encodedCount: number;
  coverage: number | null;
  percentage: number | null;
  configuredWeight: number;
  normalizedWeight: number;
  effectiveWeight: number;
};

export type SubjectGradeComputation = {
  availableCategories: string[];
  categories: CategoryResult[];
  existingAssessments: number;
  encodedAssessments: number;
  coverage: number | null;
  rawGrade: number | null;
  computedAverage: number | null;
  transmutedGrade: number | null;
  remarks: "Passed" | "Failed" | null;
};
