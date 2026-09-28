"use client";

import { MyTimetable } from "./components/MyTimetable";
import styles from "./components/classes.module.css";

export default function TeacherClassesPage() {
  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <MyTimetable />
      </div>
    </section>
  );
}
