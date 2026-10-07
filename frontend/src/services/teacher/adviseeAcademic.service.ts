// Advisee academic-detail fetch + display helper. Note: `humanize` here
// duplicates the advisory twin verbatim — kept local to avoid
// cross-service coupling.
import { apiClient } from "@/lib/api/client";
import type { StudentAcademic } from "./adviseeAcademic.types";

export async function fetchStudentAcademic(studentId: string): Promise<StudentAcademic> {
  const { data } = await apiClient.get<StudentAcademic>(
    `/api/teacher/advisory/students/${studentId}/academic`
  );
  return data;
}
