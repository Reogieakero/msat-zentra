"use client";

import * as React from "react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { AttendanceHeader } from "./components/AttendanceHeader";
import { AttendanceHeatblocks } from "./components/AttendanceHeatblocks";
import { AttendanceOverview } from "./components/AttendanceOverview";
import styles from "./components/attendance.module.css";

type Session = "AM" | "PM";

const SESSION_KEY = "attendance-heatmap:session";
const SECTION_KEY = "attendance-heatmap:sectionId";

export default function PrincipalAttendanceHeatmapsPage() {
  const [session, setSession] = usePersistentState<Session>(SESSION_KEY, "AM");
  const [selectedSectionId, setSelectedSectionId] = usePersistentState<string | null>(
    SECTION_KEY,
    null
  );

  return (
    <section className={styles.page}>
      <AttendanceHeader />

      <hr className={styles.divider} />

      <AttendanceHeatblocks
        session={session}
        onSessionChange={setSession}
        selectedSectionId={selectedSectionId}
        onSelectSection={setSelectedSectionId}
      />

      <AttendanceOverview
        session={session}
        selectedSectionId={selectedSectionId}
        onClearSection={() => setSelectedSectionId(null)}
      />
    </section>
  );
}
