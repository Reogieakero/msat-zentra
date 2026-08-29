import * as React from "react";
import { X, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { AuditEntry, isConfidentialTable, fetchAuditSource } from "../audit-data";
import styles from "./audit-drawer.module.css";

export function AuditDrawer({
  entry,
  currentUser,
  onClose,
}: {
  entry: AuditEntry | null;
  currentUser: string;
  onClose: () => void;
}) {
  const open = entry !== null;
  const confidential = entry ? isConfidentialTable(entry.sourceTable) : false;
  const [fields, setFields] = React.useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    // Async fetch on open; setState happens inside promise chain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFields([]);
    fetchAuditSource(entry.id)
      .then((res) => {
        if (!cancelled) setFields(res.fields);
      })
      .catch((err) => {
        console.error("[/api/audit/:id/source] failed:", err);
        if (!cancelled) {
          setFields([
            { label: "Source", value: `${entry.sourceTable} #${entry.sourceId}` },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!entry) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Source record detail"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Source record</h2>
            <p className={styles.subtitle}>
              {entry.sourceTable} #{entry.sourceId}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            <X className={styles.closeIcon} />
          </button>
        </header>

        {confidential ? (
          <div className={styles.notice}>
            <Lock className={styles.noticeIcon} aria-hidden />
            <span>
              Confidential source — status-only view. Clinical detail columns are
              hidden by design (O1).
            </span>
          </div>
        ) : null}

        {loading ? (
          <div className={styles.sourceSkeleton}>
            <Skeleton className={styles.skeletonRow} />
            <Skeleton className={styles.skeletonRow} />
            <Skeleton className={styles.skeletonRow} />
          </div>
        ) : (
          <dl className={styles.list}>
            {fields.map((r) => (
              <div className={styles.item} key={r.label}>
                <dt className={styles.itemLabel}>{r.label}</dt>
                <dd className={styles.itemValue}>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <footer className={styles.footer}>
          <span>Changed by {entry.user}</span>
          <span className={styles.muted}>{currentUser === entry.user ? "(you)" : ""}</span>
        </footer>
      </aside>
    </div>
  );
}
