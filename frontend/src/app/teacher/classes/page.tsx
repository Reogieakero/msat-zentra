"use client";

import { ClassesHeader } from "./components/ClassesHeader";
import { ClassesSchedule } from "./components/ClassesSchedule";
import styles from "./components/classes.module.css";

export default function TeacherClassesPage() {
  return (
    <section className={styles.page}>
      <ClassesHeader />
      <hr className={styles.divider} />

      <div className={styles.body}>
        <ClassesSchedule />
      </div>
    </section>
  );
}
