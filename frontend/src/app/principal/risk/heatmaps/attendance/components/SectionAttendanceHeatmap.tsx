import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import styles from "./attendance.module.css";

export interface AttendanceDay {
  date: string;
  isoDate: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
}

export interface SectionAttendance {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  days: AttendanceDay[];
}

// Color scale aligned to the 80% attendance threshold (see Risk/Attendance
// systems): below 80% reads amber/red (at-risk), 80%+ green (safe).
const SCALE = ["var(--hm-0)", "var(--hm-1)", "var(--hm-2)", "var(--hm-3)", "var(--hm-4)"];

function dayColor(present: number, enrolled: number): string {
  if (enrolled <= 0 || present <= 0) return SCALE[0];
  const ratio = present / enrolled;
  if (ratio >= 0.9) return SCALE[4];
  if (ratio >= 0.8) return SCALE[3];
  if (ratio >= 0.5) return SCALE[2];
  return SCALE[1];
}

function isWeekend(isoDate: string): boolean {
  if (!isoDate) return false;
  const wd = new Date(isoDate + "T00:00:00Z").getUTCDay();
  return wd === 0 || wd === 6;
}

const SESSIONS = ["AM", "PM"] as const;
type Session = (typeof SESSIONS)[number];

export function SectionAttendanceHeatmap({
  session,
  onSessionChange,
  selectedSectionId,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
  selectedSectionId?: string | null;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [sections, setSections] = React.useState<SectionAttendance[]>([]);
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    apiClient
      .get<{ session: Session; sections: SectionAttendance[] }>(
        "/api/attendance/section-heatmap",
        { params: { session } }
      )
      .then((res) => {
        if (!cancelled) setSections(res.data.sections);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("[/api/attendance/section-heatmap] fetch failed:", err);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // When a section is selected from the Grades & sections card, scroll its
  // heatblock into view within the horizontal scroller.
  React.useEffect(() => {
    if (!selectedSectionId || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(
      `[data-section-id="${selectedSectionId}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedSectionId, sections]);

  const bands = React.useMemo(() => {
    const map = new Map<string, SectionAttendance[]>();
    for (const s of sections) {
      const arr = map.get(s.gradeLevel) ?? [];
      arr.push(s);
      map.set(s.gradeLevel, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sections]);

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Section Attendance Heatblocks</h3>
          <p className={styles.subtitle}>
            Per-section daily attendance &middot; status-only
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Session">
            {SESSIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={session === s}
                className={session === s ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                onClick={() => onSessionChange(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.nav}>
            <button type="button" className={styles.arrow} onClick={() => scrollBy(-1)} aria-label="Scroll left">
              <ChevronLeft className={styles.arrowIcon} aria-hidden />
            </button>
            <button type="button" className={styles.arrow} onClick={() => scrollBy(1)} aria-label="Scroll right">
              <ChevronRight className={styles.arrowIcon} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.scroller}>
          <div className={styles.row}>
            {Array.from({ length: 6 }).map((_, i) => (
              <article key={i} className={styles.card} aria-hidden>
                <Skeleton className={styles.skeletonGrade} />
                <div className={styles.grid}>
                  {Array.from({ length: 40 }).map((_, j) => (
                    <Skeleton key={j} className={styles.skeletonBlock} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className={styles.empty}>
          <p>Unable to load attendance heatblocks.</p>
          <p className={styles.emptyHint}>Check your connection and try again.</p>
        </div>
      ) : (
        <TooltipProvider>
          <div className={styles.scroller} ref={scrollerRef}>
            <div className={styles.row}>
              {bands.map(([grade, rows]) => (
                <React.Fragment key={grade}>
                   {rows.map((s) => (
                     <article
                       key={s.sectionId}
                       data-section-id={s.sectionId}
                       className={`${styles.card} ${selectedSectionId === s.sectionId ? styles.cardSelected : ""}`}
                     >
                      <p className={styles.grade}>
                        {s.section}
                        <span className={styles.enrolled}>{s.enrolled} students</span>
                      </p>
                      <div className={styles.grid}>
                         {s.days.map((d, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <span
                                className={`${styles.block} ${isWeekend(d.isoDate) ? styles.blockWeekend : ""}`}
                                style={{ background: isWeekend(d.isoDate) ? "var(--hm-weekend)" : dayColor(d.present, s.enrolled) }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className={styles.tooltipLine}>
                                <span>
                                  {d.date} &middot; {session}
                                </span>
                                <span>
                                  {d.present} present &middot; {d.late} late &middot;{" "}
                                  {d.absent} absent &middot; {d.excused} excused
                                </span>
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </article>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className={styles.legend}>
            <span className={styles.legendLabel}>Present: 0</span>
            <span className={styles.legendSwatches}>
              {SCALE.map((c, i) => (
                <span key={i} className={styles.legendSwatch} style={{ background: c }} />
              ))}
            </span>
            <span className={styles.legendLabel}>= enrolled</span>
          </div>
        </TooltipProvider>
      )}
    </section>
  );
}
