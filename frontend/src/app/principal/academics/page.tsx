"use client";

import { StudentsAcademicsGrid } from "./components/StudentsAcademicsGrid";
import styles from "./page.module.css";

export default function PrincipalAcademicsPage() {
  return (
    <section className={styles.page}>
      <StudentsAcademicsGrid />
    </section>
  );
}
