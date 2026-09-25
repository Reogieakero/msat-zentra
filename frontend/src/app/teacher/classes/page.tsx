"use client";

import { ClassesSchedule } from "./components/ClassesSchedule";
import styles from "./components/classes.module.css";

export default function TeacherClassesPage() {
  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <ClassesSchedule />
      </div>
    </section>
  );
}
