"use client";

import * as React from "react";
import { Loader2, Users, SlidersHorizontal } from "lucide-react";
import { Search } from "lucide-react";
import {
  mockRecords,
  delay,
  type RecordStudent,
  type RecordDataset,
} from "./mockData";
import { StudentInfoPanel } from "./components/StudentInfoPanel";
import { FloatingMenu } from "../components/FloatingMenu";
import { Input } from "@/components/ui/input";
import styles from "./records.module.css";
import menu from "../components/heatmap.module.css";
import menuMod from "../components/menu.module.css";

function flatten(data: RecordDataset): RecordStudent[] {
  return data.sections.flatMap((s) => s.students);
}

type AnecdotalCategory =
  | "Discipline"
  | "Counseling"
  | "Attendance"
  | "Merit"
  | "Intervention"
  | "Bullying"
  | "Fighting";

const SEVERITY_RANK: Record<RecordStudent["behavioral"][number]["severity"], number> = {
  High: 3,
  Moderate: 2,
  Low: 1,
};

// The dominant anecdotal category for a student = the category of their most
// severe behavioral record.
function primaryCategory(student: RecordStudent): AnecdotalCategory {
  return student.behavioral.reduce((top, rec) =>
    SEVERITY_RANK[rec.severity] > SEVERITY_RANK[top.severity] ? rec : top
  ).category;
}

const CATEGORY_LEGEND: AnecdotalCategory[] = [
  "Discipline",
  "Counseling",
  "Attendance",
  "Merit",
  "Intervention",
  "Bullying",
  "Fighting",
];

const CATEGORY_COLOR: Record<AnecdotalCategory, string> = {
  Discipline: "#b91c1c",
  Counseling: "#1d4ed8",
  Attendance: "#b45309",
  Merit: "#15803d",
  Intervention: "#6d28d9",
  Bullying: "#be185d",
  Fighting: "#0f766e",
};

export default function PrincipalRecordsPage() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<RecordDataset | null>(null);
  const [query, setQuery] = React.useState("");

  const [selected, setSelected] = React.useState<RecordStudent | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    delay(mockRecords, 600).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
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
      .filter((s) => s.students.length > 0);
  }, [data, query]);

  const visibleStudents = React.useMemo(() => flatten({ schoolYear: data?.schoolYear ?? "", sections: filteredSections }), [filteredSections, data]);

  const selectedInView =
    selected && visibleStudents.some((s) => s.lrn === selected.lrn) ? selected : null;

  const onSelect = (s: RecordStudent) => {
    setSelected(s);
  };

  const legend = (
    <div className={menuMod.legend} aria-label="Anecdotal category legend">
      <span className={menuMod.legendTitle}>Anecdotal records</span>
        {CATEGORY_LEGEND.map((cat) => (
          <span key={cat} className={menuMod.legendItem}>
            <span
              className={menuMod.legendDot}
              style={{ backgroundColor: CATEGORY_COLOR[cat] }}
              aria-hidden
            />
            {cat}
          </span>
        ))}
    </div>
  );

  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <FloatingMenu selected="behavioral-count" onSelect={() => {}} legend={legend} />

        <section className={styles.page}>
          <header className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.kicker}>
            <Users size={14} aria-hidden /> Student Records
          </span>
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
        >
          {loading ? (
            <div className={styles.loading}>
              <Loader2 className={styles.spin} aria-hidden />
              <span>Loading student records…</span>
            </div>
          ) : visibleStudents.length === 0 ? (
            <div className={styles.empty}>
              <SlidersHorizontal className={styles.emptyIcon} aria-hidden />
              <p>No students match the current filters.</p>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.sectionId} className={styles.gradeGroup}>
                <div className={styles.gradeHead}>
                  <span className={styles.gradeLabel}>Grade {section.gradeLevel}</span>
                  <span className={styles.sectionLabel}>{section.section.replace(`Grade ${section.gradeLevel}-`, "Section ")}</span>
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
