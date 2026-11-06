import { redirect } from "next/navigation";

/** Student login lands here — send learners straight to their modules. */
export default function StudentHomePage() {
  redirect("/student/modules");
}
