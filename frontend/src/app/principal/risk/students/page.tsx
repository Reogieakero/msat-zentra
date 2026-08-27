"use client";

import * as React from "react";
import {
  fetchHeatmap,
  fetchRiskBoard,
  fetchRiskStudents,
  type RiskFactor,
  type BackendHeatmap,
  type BackendBoard,
  type BackendStudent,
} from "./api";
import { useGradeMode } from "../../grade-mode-context";
import { BrowserCard } from "./components/BrowserCard";
import { SectionHeatmap } from "./components/SectionHeatmap";
import { RiskKpiRail } from "./components/RiskKpiRail";
import { StudentsTable } from "./components/StudentsTable";
import styles from "./students.module.css";

const FACTORS: RiskFactor[] = ["Academic", "Attendance", "Behavioral"];
const STORAGE_KEY = "zentra.riskStudents.activeSection";

export default function RiskBoardStudentsPage() {
  const { gradeMode } = useGradeMode();
  const [loading, setLoading] = React.useState(true);
  const [selectedSection, setSelectedSection] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const activeTabRef = React.useRef<string | null>(null);

  // Restore the persisted section via useSyncExternalStore so the server and
  // the first client render agree (null), then the stored value is applied
  // after hydration — no setState-in-effect, no hydration mismatch.
  const storedSection = React.useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    () => null
  );

  React.useEffect(() => {
    if (storedSection && !activeTabRef.current) {
      activeTabRef.current = storedSection;
      setActiveTab(storedSection);
      setSelectedSection(storedSection);
    }
  }, [storedSection]);

  const [heat, setHeat] = React.useState<BackendHeatmap | null>(null);
  const [heatError, setHeatError] = React.useState<string | null>(null);
  const [board, setBoard] = React.useState<BackendBoard | null>(null);
  const [boardError, setBoardError] = React.useState<string | null>(null);

  const heatmapRef = React.useRef<HTMLDivElement>(null);
  const scrollToHeatmap = () =>
    heatmapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  React.useEffect(() => {
    let cancelled = false;
    fetchHeatmap()
      .then((res) => {
        if (!cancelled) {
          setHeat(res);
          setHeatError(null);
          setLoading(false);
          if (!activeTabRef.current && res.sections.length > 0) {
            setActiveTab(res.sections[0].section);
            setSelectedSection(res.sections[0].section);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHeatError(httpError("Failed to load heat map", err));
          console.error("[/api/risk/heatmap] fetch failed:", err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchRiskBoard()
      .then((res) => {
        if (!cancelled) {
          setBoard(res);
          setBoardError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBoardError(httpError("Failed to load board", err));
          console.error("[/api/risk/board] fetch failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-section data is fetched server-side (the /api/risk/students endpoint
  // accepts a `section` filter). Cache each scope so tab switches are instant
  // after the first load.
  const cacheRef = React.useRef<Record<string, BackendStudent[]>>({});
  const [students, setStudents] = React.useState<BackendStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = React.useState(true);
  const [studentsError, setStudentsError] = React.useState<string | null>(null);

  const scopeKey = selectedSection ?? "";

  React.useEffect(() => {
    const cached = cacheRef.current[`${scopeKey}:${gradeMode}`];
    if (cached) {
      setStudents(cached);
      setStudentsLoading(false);
      setStudentsError(null);
      return;
    }
    let cancelled = false;
    setStudentsLoading(true);
    fetchRiskStudents(scopeKey === "" ? undefined : scopeKey, gradeMode)
      .then((res) => {
        if (!cancelled) {
          cacheRef.current[`${scopeKey}:${gradeMode}`] = res.students;
          setStudents(res.students);
          setStudentsError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStudentsError(httpError("Failed to load students", err));
          console.error("[/api/risk/students] fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeKey, gradeMode]);

  const [query, setQuery] = React.useState("");

  // Search filters by LRN only (names are hidden for confidentiality).
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.lrn.toLowerCase().includes(q));
  }, [students, query]);

  const persistSection = (section: string) => {
    activeTabRef.current = section;
    setActiveTab(section);
    setSelectedSection(section);
    try {
      localStorage.setItem(STORAGE_KEY, section);
    } catch {
      /* ignore storage errors */
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Risk Board — Students</h1>
          <p className={styles.subtitle}>
            School-wide at-risk learners · status-only view
          </p>
        </div>
        <button
          type="button"
          className={styles.banner}
          onClick={scrollToHeatmap}
          aria-label="See heatmap"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.bannerImg}
            src="https://picsum.photos/seed/zentra-heatmap/600/200"
            alt="Heatmap preview banner"
          />
          <div className={styles.bannerOverlay}>
            <p className={styles.bannerTitle}>See Heatmap</p>
            <p className={styles.bannerSub}>
              Explore the section × risk-factor heat map below.
            </p>
          </div>
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <SectionHeatmap
            heat={heat}
            loading={loading}
            error={heatError}
            factors={FACTORS}
            selectedSection={selectedSection}
            onSelect={persistSection}
            titleRef={heatmapRef}
          />
        </div>

        <RiskKpiRail
          board={board}
          heat={heat}
          loading={loading}
          boardError={boardError}
        />
      </div>

      <BrowserCard
        title={
          selectedSection
            ? `zentra.edu / principal / risk / students / ${selectedSection}`
            : "zentra.edu / principal / risk / students"
        }
        tabs={[
          ...(heat?.sections ?? []).map((row) => ({
            id: row.section,
            label: row.section,
          })),
        ]}
        activeTab={activeTab ?? undefined}
        onTabChange={persistSection}
        search={query}
        onSearchChange={setQuery}
      >
        <StudentsTable
          students={filtered}
          loading={studentsLoading}
          error={studentsError}
          query={query}
          factors={FACTORS}
          selectedSection={selectedSection}
        />
      </BrowserCard>
    </section>
  );
}

function httpError(base: string, err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status ? `${base} (HTTP ${status})` : base;
}
