"use client";

import { StudentsAcademicsGrid } from "./components/StudentsAcademicsGrid";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import styles from "./page.module.css";

export default function PrincipalAcademicsPage() {
  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="Academic Performance"
        description="A school-wide view of grading, honor roll, and at-risk performance across every grade level and section."
      />
      <StudentsAcademicsGrid />
    </section>
  );
}
