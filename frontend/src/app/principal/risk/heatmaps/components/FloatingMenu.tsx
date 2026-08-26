"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flame, Activity, GraduationCap } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { mockMenuSections, type MenuSection } from "./mockData";
import styles from "./menu.module.css";

const RECORDS_PATH = "/principal/risk/heatmaps/records";
const ATTENDANCE_PATH = "/principal/risk/heatmaps/attendance";
const ACADEMIC_PATH = "/principal/risk/heatmaps/academics";

const ROUTE_BY_ID: Record<string, string> = {
  "attendance-heatmap": ATTENDANCE_PATH,
  "behavioral-count": RECORDS_PATH,
  "academic-heatmap": ACADEMIC_PATH,
};

const ITEMS = [
  { id: "attendance-heatmap", label: "Attendance Heat Map", icon: Activity },
  { id: "behavioral-count", label: "Behavioral Records", icon: Flame },
  { id: "academic-heatmap", label: "Academic Heat Map", icon: GraduationCap },
] as const;

export function FloatingMenu({
  selected,
  onSelect,
  legend,
  gradeCard,
  selectedSectionId,
  onSelectSection,
}: {
  selected: string;
  onSelect: (id: string) => void;
  legend?: React.ReactNode;
  gradeCard?: React.ReactNode;
  selectedSectionId?: string | null;
  onSelectSection?: (id: string | null) => void;
}) {
  const [sections, setSections] = React.useState<MenuSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const pinned = React.useRef(false);
  const router = useRouter();
  const sectionRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // Once the section list is loaded, scroll the active (e.g. persisted)
  // section into view so the Grades & sections card reflects the selection.
  React.useEffect(() => {
    if (!selectedSectionId || sections.length === 0) return;
    const el = sectionRefs.current.get(selectedSectionId);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedSectionId, sections]);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    apiClient
      .get<{ sections: MenuSection[] }>("/api/attendance/sections")
      .then((res) => {
        if (!cancelled) setSections(res.data.sections);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("[/api/attendance/sections] fetch failed:", err);
          setSections(mockMenuSections());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the incoming selected section no longer exists in the loaded list
  // (e.g. a persisted id from a previous term), clear it so the card and the
  // rest of the page don't stay stuck on a stale selection.
  React.useEffect(() => {
    if (
      selectedSectionId &&
      sections.length > 0 &&
      !sections.some((s) => s.id === selectedSectionId)
    ) {
      onSelectSection?.(null);
    }
  }, [selectedSectionId, sections, onSelectSection]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !pinned.current) onSelect(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [onSelect]);

  const choose = (id: string) => {
    pinned.current = true;
    onSelect(id);
    go(id);
  };

  // Group sections by grade for the list.
  const byGrade = React.useMemo(() => {
    const map = new Map<string, MenuSection[]>();
    for (const s of sections) {
      const arr = map.get(s.grade) ?? [];
      arr.push(s);
      map.set(s.grade, arr);
    }
    return Array.from(map.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [sections]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.float}>
      <nav className={styles.menu} aria-label="Page sections">
        <span className={styles.menuLabel}>On this page</span>
        <ul className={styles.list}>
          {ITEMS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className={`${styles.item} ${selected === id ? styles.itemActive : ""}`}
                onClick={() =>
                  ROUTE_BY_ID[id] ? router.push(ROUTE_BY_ID[id]) : choose(id)
                }
              >
                <Icon size={15} className={styles.icon} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

       {selected === "attendance-heatmap" ? (
        <nav className={styles.menu} aria-label="Grades and sections">
          <span className={styles.menuLabel}>Grades &amp; sections</span>
          {loading ? (
            <div className={styles.grades}>
              {Array.from({ length: 6 }).map((_, gi) => (
                <div key={gi} className={styles.gradeGroup}>
                  <Skeleton className={styles.gradeHeadSkel} />
                  <div className={styles.sectionList}>
                    {Array.from({ length: 2 }).map((__, si) => (
                      <Skeleton key={si} className={styles.sectionItemSkel} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.grades}>
              {byGrade.map(([grade, secs]) => (
              <div key={grade} className={styles.gradeGroup}>
                <p className={styles.gradeHead}>Grade {grade}</p>
                <ul className={styles.sectionList}>
                   {secs.map((s) => (
                    <li key={s.id}>
                      <button
                        ref={(el) => {
                          if (el) sectionRefs.current.set(s.id, el);
                          else sectionRefs.current.delete(s.id);
                        }}
                        type="button"
                        className={`${styles.sectionItem} ${selectedSectionId === s.id ? styles.sectionItemActive : ""}`}
                        aria-pressed={selectedSectionId === s.id}
                        onClick={() => {
                          if (onSelectSection) onSelectSection(s.id);
                          go("attendance");
                        }}
                      >
                        {s.section.replace("Grade ", "")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          )}
        </nav>
      ) : null}

      {gradeCard ? <div className={styles.gradeCard}>{gradeCard}</div> : null}
      {legend ? <div className={styles.legend}>{legend}</div> : null}
    </div>
  );
}
