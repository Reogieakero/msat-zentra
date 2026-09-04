"use client";

import { useState } from "react";
import { RaiseFlagChat } from "./components/RaiseFlagChat";
import { FlagHistory } from "./components/FlagHistory";
import styles from "./components/grade-flags.module.css";

export default function TeacherGradeFlagsPage() {
  const [view, setView] = useState<"compose" | "history">("compose");

  return (
    <section className={styles.page}>
      {view === "compose" ? (
        <div className={styles.body}>
          <RaiseFlagChat onHistory={() => setView("history")} />
        </div>
      ) : (
        <div className={styles.boardWrap}>
          <FlagHistory onBack={() => setView("compose")} />
        </div>
      )}
    </section>
  );
}
