"use client";

import { useState } from "react";
import { AttendanceRosterRail } from "./components/AttendanceRosterRail";
import { AttendanceSheet } from "./components/AttendanceSheet";
import {
  isEditableDay,
  phTodayKey,
  type SheetSession,
} from "./components/attendance-taking-data";
import styles from "./components/attendance-sheet.module.css";

export default function TeacherAdvisoryAttendancePage() {
  const [date] = useState(phTodayKey);
  const [session] = useState<SheetSession>("AM");

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <AttendanceRosterRail date={date} session={session} />
        <AttendanceSheet
          date={date}
          session={session}
          editable={isEditableDay(date)}
        />
      </div>
    </section>
  );
}
