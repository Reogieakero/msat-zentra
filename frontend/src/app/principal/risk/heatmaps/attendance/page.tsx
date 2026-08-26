"use client";

import * as React from "react";
import { SectionAttendanceHeatmap } from "./components/SectionAttendanceHeatmap";
import { AttendanceBelow } from "./components/AttendanceBelow";
import { FloatingMenu } from "../components/FloatingMenu";
import styles from "./components/attendance.module.css";
import menu from "../components/heatmap.module.css";

type Session = "AM" | "PM";

export default function PrincipalAttendanceHeatmapsPage() {
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session>("AM");

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <FloatingMenu
          selected="attendance-heatmap"
          onSelect={() => {}}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
        />

        <section className={styles.page}>

          <div id="attendance-heatmap">
            <SectionAttendanceHeatmap
              session={session}
              onSessionChange={setSession}
              selectedSectionId={selectedSectionId}
            />
          </div>
          <div id="attendance">
            <AttendanceBelow
              selectedSectionId={selectedSectionId}
              onClearSection={() => setSelectedSectionId(null)}
              session={session}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
