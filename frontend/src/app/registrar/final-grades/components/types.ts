export type FinalGradeStatus = "pending" | "approve";

export type FinalGrade = {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: "G11" | "G12";
  section: string;
  subject: string;
  term: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: "Passed" | "Failed" | "—";
  status: FinalGradeStatus;
};

export type FinalGradesResponse = {
  grades: FinalGrade[];
  total: number;
  pending: number;
  approved: number;
  page: number;
  pageSize: number;
};
