"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { SectionAttendanceHeatmap } from "./components/SectionAttendanceHeatmap";
import { AttendanceBelow } from "./components/AttendanceBelow";
import { FloatingMenu } from "../components/FloatingMenu";
import styles from "./components/attendance.module.css";
import menu from "../components/heatmap.module.css";

type Session = "AM" | "PM";

const SESSION_KEY = "attendance-heatmap:session";
const SECTION_KEY = "attendance-heatmap:sectionId";

function readSession(): Session {
  if (typeof window === "undefined") return "AM";
  return window.localStorage.getItem(SESSION_KEY) === "PM" ? "PM" : "AM";
}

function readSection(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SECTION_KEY);
}

export default function PrincipalAttendanceHeatmapsPage() {
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<Session>("AM");
  const [hydrated, setHydrated] = React.useState(false);
  // Skips the initial mount run of the persistence effects so they don't
  // overwrite/delete the stored values before hydration restores them.
  const mounted = React.useRef(false);

  // Hydrate persisted selections on the client only, after mount, so the
  // server-rendered HTML matches the initial client render and avoids a
  // hydration mismatch. The `hydrated` flag ensures the data-dependent
  // children only fetch once, using the restored section + session.
  React.useEffect(() => {
    const restoredSession = readSession();
    const restoredSection = readSection();
    setSession(restoredSession);
    setSelectedSectionId(restoredSection);
    window.localStorage.setItem(SESSION_KEY, restoredSession);
    if (restoredSection) window.localStorage.setItem(SECTION_KEY, restoredSection);
    else window.localStorage.removeItem(SECTION_KEY);
    setHydrated(true);
    // Flip the "mounted" flag on a later tick so the persistence effects in
    // THIS commit still see `false` and skip — otherwise they would run with
    // the stale initial state ("AM"/null) and overwrite the restored values.
    queueMicrotask(() => {
      mounted.current = true;
    });
  }, []);

  React.useEffect(() => {
    if (!mounted.current) return;
    window.localStorage.setItem(SESSION_KEY, session);
  }, [session]);

  React.useEffect(() => {
    if (!mounted.current) return;
    if (selectedSectionId) window.localStorage.setItem(SECTION_KEY, selectedSectionId);
    else window.localStorage.removeItem(SECTION_KEY);
  }, [selectedSectionId]);

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
          {hydrated ? (
            <>
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
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
