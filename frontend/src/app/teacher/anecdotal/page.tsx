"use client";

import { AnecdotalChat } from "./components/AnecdotalChat";
import styles from "./components/anecdotal-workspace.module.css";

export default function TeacherAnecdotalPage() {
  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <AnecdotalChat />
      </div>
    </section>
  );
}
