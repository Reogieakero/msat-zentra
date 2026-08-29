import * as React from "react";
import { Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className={styles.sheet}>
        {entry && (
          <>
            <SheetHeader>
              <SheetTitle>Source record</SheetTitle>
              <SheetDescription className={styles.subtitle}>
                {entry.sourceTable} #{entry.sourceId}
              </SheetDescription>
            </SheetHeader>

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

            <SheetFooter className={styles.footer}>
              <span>Changed by {entry.user}</span>
              <span className={styles.muted}>
                {currentUser === entry.user ? "(you)" : ""}
              </span>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
