"use client";

import { AcademicsHeader } from "./components/AcademicsHeader";
import { StudentsAcademicsGrid } from "./components/StudentsAcademicsGrid";
import styles from "./page.module.css";

export default function PrincipalAcademicsPage() {
  return (
    <section className={styles.page}>
      <AcademicsHeader />
      <hr className={styles.divider} />
      <div className={styles.gridSection}>
        <h2 className={styles.gridTitle}>Student Academic Reports</h2>
        <StudentsAcademicsGrid />
      </div>
    </section>
  );
}
