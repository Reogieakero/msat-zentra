import * as React from "react";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { mockSessionPattern, delay, type SessionPattern } from "./mockData";
import styles from "./floats.module.css";

export function PatternFloats({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [pattern, setPattern] = React.useState<SessionPattern | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    delay(mockSessionPattern(), 450)
      .then((p) => {
        if (!cancelled) setPattern(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`${styles.layer} ${visible ? styles.layerVisible : ""}`}
      onTransitionEnd={(e) => {
        if (e.propertyName === "opacity" && !visible) onClose();
      }}
    >
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Session</h3>
            <button
              type="button"
              className={styles.close}
              aria-label="Close patterns"
              onClick={handleClose}
            >
              <X size={16} />
            </button>
          </div>
          {loading || !pattern ? (
            <Skeleton className={styles.skel} />
          ) : (
            <div className={styles.pattern}>
              <div className={styles.sessionRow}>
                <span className={styles.sessionLabel}>AM</span>
                <span className={styles.sessionBar}>
                  <span
                    className={styles.sessionFill}
                    style={{ width: `${pattern.amRate}%`, background: "#15803d" }}
                  />
                </span>
                <span className={styles.sessionVal}>{pattern.amRate}%</span>
              </div>
              <div className={styles.sessionRow}>
                <span className={styles.sessionLabel}>PM</span>
                <span className={styles.sessionBar}>
                  <span
                    className={styles.sessionFill}
                    style={{ width: `${pattern.pmRate}%`, background: "#d97706" }}
                  />
                </span>
                <span className={styles.sessionVal}>{pattern.pmRate}%</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>By weekday</h3>
          </div>
          {loading || !pattern ? (
            <Skeleton className={styles.skel} />
          ) : (
            <div className={styles.dayBars}>
              {pattern.byDay.map((d) => (
                <div key={d.day} className={styles.dayCol}>
                  <span
                    className={styles.dayBar}
                    style={{
                      height: `${d.rate}%`,
                      background:
                        d.rate < 80 ? "#ef4444" : d.rate < 90 ? "#f59e0b" : "#15803d",
                    }}
                  />
                  <span className={styles.dayLabel}>{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
