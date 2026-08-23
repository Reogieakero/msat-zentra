import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SCHOOL_DAYS } from "./data";
import styles from "./attendance-heatmap.module.css";

function dayColor(rate: number): string {
  if (rate >= 0.97) return "#216e39";
  if (rate >= 0.94) return "#30a14e";
  if (rate >= 0.9) return "#40c463";
  if (rate >= 0.85) return "#9be9a8";
  return "#ebedf0";
}

export function AttendanceHeatmap() {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>Attendance Heat Map</h3>
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
      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.row}>
          {SCHOOL_DAYS.map((g) => (
            <article key={g.grade} className={styles.card}>
              <p className={styles.grade}>{g.grade}</p>
              <div className={styles.grid}>
                {g.days.map((d, i) => {
                  const rate = d.total > 0 ? d.present / d.total : 0;
                  return (
                    <span
                      key={i}
                      className={styles.block}
                      style={{ background: dayColor(rate) }}
                      title={`Day ${i + 1}: ${d.present}/${d.total} present`}
                    />
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
