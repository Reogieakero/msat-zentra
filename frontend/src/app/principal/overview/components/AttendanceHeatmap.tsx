import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./attendance-heatmap.module.css";

type GradeDay = {
  date: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
};
type HeatGrade = { grade: string; enrolled: number; days: GradeDay[] };
type HeatmapResponse = { session: "AM" | "PM"; grades: HeatGrade[] };

// Color scale: lightest = 0, darkest green = present === enrolled (full attendance).
const SCALE = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

function dayColor(count: number, enrolled: number): string {
  if (enrolled <= 0 || count <= 0) return SCALE[0];
  const ratio = count / enrolled;
  if (ratio >= 0.999) return SCALE[4];
  if (ratio >= 0.66) return SCALE[3];
  if (ratio >= 0.33) return SCALE[2];
  return SCALE[1];
}

const SESSIONS = ["AM", "PM"] as const;
type Session = (typeof SESSIONS)[number];

export function AttendanceHeatmap() {
  const [session, setSession] = React.useState<Session>("AM");
  const [grades, setGrades] = React.useState<HeatGrade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    apiClient
      .get<HeatmapResponse>("/api/attendance/heatmap", { params: { session, status: "present" } })
      .then((res) => {
        if (!cancelled) setGrades(res.data.grades);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const code = (err as { response?: { status?: number } })?.response?.status;
          setError(code ? `Failed to load heat map (HTTP ${code})` : "Failed to load heat map");
          console.error("[/api/attendance/heatmap] fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>Attendance Heat Map</h3>
        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Attendance session">
            {SESSIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={session === s}
                className={session === s ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                onClick={() => setSession(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
            >
              <ChevronLeft className={styles.arrowIcon} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
            >
              <ChevronRight className={styles.arrowIcon} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : (
        <TooltipProvider>
          <div className={styles.scroller} ref={scrollerRef}>
            <div className={styles.row}>
              {grades.map((g) => (
                <article key={g.grade} className={styles.card}>
                  <p className={styles.grade}>
                    {g.grade}
                    <span className={styles.enrolled}>{g.enrolled} students</span>
                  </p>
                  <div className={styles.grid}>
                    {g.days.map((d, i) => {
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <span
                              className={styles.block}
                              style={{ background: dayColor(d.present, g.enrolled) }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <span className={styles.tooltipLine}>
                              <span>
                                {d.date} · {session}
                              </span>
                              <span>
                                {d.present} present · {d.late} late · {d.absent} absent · {d.excused} excused
                              </span>
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </article>
              ))}
              {loading && grades.length === 0 ? (
                <article className={styles.card}>
                  <p className={styles.grade}>Loading…</p>
                </article>
              ) : null}
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
