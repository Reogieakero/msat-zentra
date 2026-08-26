"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Search } from "lucide-react";
import {
  type RecordStudent,
  type RecordDataset,
} from "./types";
import { StudentInfoPanel } from "./components/StudentInfoPanel";
import { FloatingMenu } from "../components/FloatingMenu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { formatSectionShort } from "@/lib/utils";
import styles from "./records.module.css";
import menu from "../components/heatmap.module.css";
import menuMod from "../components/menu.module.css";

function flatten(data: RecordDataset): RecordStudent[] {
  return data.sections.flatMap((s) => s.students);
}

// Shape returned by GET /api/anecdotal/records (see backend anecdotal.routes.ts).
type RawBackendRecord = {
  id: string;
  date: string;
  category: BackendCategory;
  description: string;
  severity: "Low" | "Moderate" | "High";
  staff: string;
  resolution: string;
  followUp: "Pending" | "Resolved" | "Monitoring";
};

type RawBackendStudent = {
  lrn: string;
  name: string;
  status: string;
  gradeLevel: string; // "G7" … "G12"
  section: string; // "Grade 7-A"
  sectionId: string;
  behavioral: RawBackendRecord[];
};

type RawBackendSection = {
  sectionId: string;
  section: string;
  gradeLevel: string;
  students: RawBackendStudent[];
};

const GRADE_PREFIX = "G"; // GradeLevel enum values are G7…G12

function normalizeGrade(level: string): string {
  return level.startsWith(GRADE_PREFIX) ? level.slice(GRADE_PREFIX.length) : level;
}

function normalizeStatus(status: string): RecordStudent["status"] {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "New";
    case "inactive":
    case "archived":
      return "Inactive";
    default:
      return "Active";
  }
}

// Adapt the backend records payload to the frontend RecordDataset shape. Falls
// back to mock typing when the live payload is unavailable (handled by caller).
function normalizeRecords(raw: {
  schoolYear: string;
  sections: RawBackendSection[];
}): RecordDataset {
  return {
    schoolYear: raw.schoolYear,
    sections: raw.sections.map((section) => ({
      sectionId: section.sectionId,
      section: section.section,
      gradeLevel: normalizeGrade(section.gradeLevel),
      students: section.students.map((st) => ({
        lrn: st.lrn,
        name: st.name,
        status: normalizeStatus(st.status),
        gradeLevel: normalizeGrade(st.gradeLevel),
        section: st.section,
        sectionId: st.sectionId,
        academic: { averageGrade: "", sf10Status: "Missing", missingRecords: [], completion: 0 },
        behavioral: st.behavioral,
      })),
    })),
  };
}

// Backend anecdotal categories (mirror of AnecdotalCategory enum in the backend).
type BackendCategory = "behavioral" | "bullying" | "academic" | "attendance" | "health";

const SEVERITY_RANK: Record<RecordStudent["behavioral"][number]["severity"], number> = {
  High: 3,
  Moderate: 2,
  Low: 1,
};

// The dominant anecdotal category for a student = the category of their most
// severe behavioral record.
function primaryCategory(student: RecordStudent): BackendCategory {
  return student.behavioral.reduce((top, rec) =>
    SEVERITY_RANK[rec.severity] > SEVERITY_RANK[top.severity] ? rec : top
  ).category as BackendCategory;
}

// Canonical backend anecdotal categories (must match backend AnecdotalCategory
// enum + CATEGORY_META in backend/src/modules/anecdotal/anecdotal.routes.ts).
const CATEGORY_META: Record<BackendCategory, { label: string; color: string }> = {
  behavioral: { label: "Behavioral", color: "#166534" },
  bullying: { label: "Bullying", color: "#b91c1c" },
  academic: { label: "Academic", color: "#1d4ed8" },
  attendance: { label: "Attendance", color: "#c2410c" },
  health: { label: "Health", color: "#7c3aed" },
};

const CATEGORY_COLOR: Record<BackendCategory, string> = {
  behavioral: CATEGORY_META.behavioral.color,
  bullying: CATEGORY_META.bullying.color,
  academic: CATEGORY_META.academic.color,
  attendance: CATEGORY_META.attendance.color,
  health: CATEGORY_META.health.color,
};

type LegendCategory = { key: string; label: string; color: string; value: number };

export default function PrincipalRecordsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [data, setData] = React.useState<RecordDataset | null>(null);
  const [query, setQuery] = React.useState("");

  const [selected, setSelected] = React.useState<RecordStudent | null>(null);
  const [legendCategories, setLegendCategories] = React.useState<LegendCategory[]>(
    (Object.keys(CATEGORY_META) as BackendCategory[]).map((key) => ({
      key,
      label: CATEGORY_META[key].label,
      color: CATEGORY_META[key].color,
      value: 0,
    }))
  );

  // Grade-level selection for the floating card; null = all grades.
  const [selectedGrade, setSelectedGrade] = React.useState<string | null>(null);
  const heatmapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ schoolYear: string; sections: RawBackendSection[] }>("/api/anecdotal/records")
      .then((res) => {
        if (cancelled) return;
        setData(normalizeRecords(res.data));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[/api/anecdotal/records] fetch failed:", err);
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wire the floating-card legend to the backend's anecdotal category summary.
  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ categories: LegendCategory[] }>("/api/anecdotal/summary")
      .then((res) => {
        if (!cancelled && res.data?.categories?.length) setLegendCategories(res.data.categories);
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("[/api/anecdotal/summary] fetch failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSections = React.useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.sections
      .map((s) => ({
        ...s,
        students: s.students
          .filter((st) => st.behavioral.length > 0)
          .filter((st) =>
            q
              ? st.lrn.toLowerCase().includes(q) || st.name.toLowerCase().includes(q)
              : true
          ),
      }))
      .filter((s) => s.students.length > 0)
      .filter((s) => (selectedGrade ? s.gradeLevel === selectedGrade : true));
  }, [data, query, selectedGrade]);

  // Distinct grade levels present in the data, sorted ascending, for the card.
  const availableGrades = React.useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.sections.forEach((s) => set.add(s.gradeLevel));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  // Auto-scroll the heatmap to the chosen grade when the user picks one.
  React.useEffect(() => {
    if (!selectedGrade || !heatmapRef.current) return;
    const target = heatmapRef.current.querySelector<HTMLElement>(
      `[data-grade="${selectedGrade}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedGrade, filteredSections]);

  const gradeCard = (
    <div aria-label="Filter by grade level">
      <span className={menuMod.gradeCardTitle}>Grade level</span>
      <div className={menuMod.sectionList}>
        <button
          type="button"
          className={`${menuMod.sectionItem} ${selectedGrade === null ? menuMod.sectionItemActive : ""}`}
          onClick={() => setSelectedGrade(null)}
        >
          All
        </button>
        {availableGrades.map((g) => (
          <button
            key={g}
            type="button"
            className={`${menuMod.sectionItem} ${selectedGrade === g ? menuMod.sectionItemActive : ""}`}
            onClick={() => setSelectedGrade(g)}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );

  const visibleStudents = React.useMemo(() => flatten({ schoolYear: data?.schoolYear ?? "", sections: filteredSections }), [filteredSections, data]);

  const selectedInView =
    selected && visibleStudents.some((s) => s.lrn === selected.lrn) ? selected : null;

  const onSelect = (s: RecordStudent) => {
    setSelected(s);
  };

  const legend = (
    <div className={menuMod.legend} aria-label="Anecdotal category legend">
      <span className={menuMod.legendTitle}>Anecdotal records</span>
        {legendCategories.map((cat) => (
          <span key={cat.key} className={menuMod.legendItem}>
            <span
              className={menuMod.legendDot}
              style={{ backgroundColor: cat.color }}
              aria-hidden
            />
            {cat.label}
          </span>
        ))}
    </div>
  );

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <FloatingMenu selected="behavioral-count" onSelect={() => {}} legend={legend} gradeCard={gradeCard} />

        <section className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1 className={styles.title}>Records Heatmap</h1>
          <p className={styles.subtitle}>
            {data ? `School year ${data.schoolYear}` : "Loading…"} · {visibleStudents.length} students in view
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.search}>
            <Search size={15} className={styles.searchIcon} aria-hidden />
            <Input
              type="search"
              placeholder="Search LRN or name"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label="Search students"
              className={styles.searchInput}
            />
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div
          className={styles.heatmap}
          ref={heatmapRef}
        >
          {loading ? (
            <div className={styles.skeletonWrap} aria-busy="true" aria-label="Loading student records">
              {Array.from({ length: 4 }).map((_, gi) => (
                <div key={gi} className={styles.gradeGroup}>
                  <div className={styles.gradeHead}>
                    <Skeleton className={styles.skelHead} />
                  </div>
                  <div className={styles.blockGrid}>
                    {Array.from({ length: 6 }).map((__, bi) => (
                      <div key={bi} className={styles.skelBlock}>
                        <Skeleton className={styles.skelDot} />
                        <div className={styles.skelText}>
                          <Skeleton className={styles.skelName} />
                          <Skeleton className={styles.skelLrn} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={styles.empty}>
              <SlidersHorizontal className={styles.emptyIcon} aria-hidden />
              <p>Unable to load student records.</p>
            </div>
          ) : visibleStudents.length === 0 ? (
            <div className={styles.empty}>
              <SlidersHorizontal className={styles.emptyIcon} aria-hidden />
              <p>No students match the current filters.</p>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.sectionId} className={styles.gradeGroup} data-grade={section.gradeLevel}>
                <div className={styles.gradeHead}>
                  <span className={styles.gradeLabel}>Grade {section.gradeLevel}</span>
                  <span className={styles.sectionLabel}>{formatSectionShort(section.section)}</span>
                  <span className={styles.gradeCount}>{section.students.length}</span>
                </div>
                <div className={styles.blockGrid}>
                  {section.students.map((s, i) => {
                    const state = selectedInView?.lrn === s.lrn ? styles.blockSelected : "";
                    return (
                      <button
                        key={s.lrn}
                        type="button"
                        className={`${styles.block} ${state}`}
                        style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }}
                        onClick={() => onSelect(s)}
                        aria-pressed={selectedInView?.lrn === s.lrn}
                        aria-label={`${s.name}, LRN ${s.lrn}, ${s.status}`}
                      >
                        <span
                          className={styles.blockDot}
                          style={{ backgroundColor: CATEGORY_COLOR[primaryCategory(s)] }}
                          aria-hidden
                        />
                        <span className={styles.blockText}>
                          <span className={styles.blockName}>{s.name}</span>
                          <span className={styles.blockLrn}>{s.lrn}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <StudentInfoPanel student={selectedInView} onClose={() => setSelected(null)} />
        </div>
      </section>
      </div>
    </div>
  );
}
