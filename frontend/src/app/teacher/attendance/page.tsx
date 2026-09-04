"use client";

import { useState } from "react";
import { AttendanceSheetHeader, type SheetSession } from "./components/AttendanceSheetHeader";
import { AttendanceSheet } from "./components/AttendanceSheet";
import { isEditableDay, phTodayKey } from "./components/attendance-taking-data";
import styles from "./components/attendance-sheet.module.css";

export default function TeacherAdvisoryAttendancePage() {
  const today = phTodayKey();
  const [date, setDate] = useState(today);
  const [session, setSession] = useState<SheetSession>("AM");

  return (
    <section className={styles.page}>
      <AttendanceSheetHeader
        date={date}
        onDateChange={setDate}
        session={session}
        onSessionChange={setSession}
        maxDate={today}
      />
      <hr className={styles.divider} />

      <div className={styles.body}>
        <AttendanceSheet
          date={date}
          session={session}
          isToday={date === today}
          editable={isEditableDay(date)}
        />
      </div>
    </section>
  );
}
