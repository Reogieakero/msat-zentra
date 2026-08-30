import * as React from "react";
import { FileCheck2, FileX2, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Sf10RecordForAdvisee, Sf10RecordStatus } from "./types";
import { apiClient } from "@/lib/api/client";
import styles from "./sf10-confirm-modal.module.css";

type RecordsResponse = { requestId: string; records: Sf10RecordForAdvisee[] };

type Props = {
  requestId: string;
  adviserName: string;
  section: string;
  open: boolean;
  acting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function statusBadge(status: Sf10RecordStatus | undefined) {
  if (status === "released")
    return <Badge variant="default" className={styles.released}>Released</Badge>;
  if (status === "available")
    return <Badge variant="secondary">Available</Badge>;
  if (status === "attach")
    return <Badge variant="warning">Attach</Badge>;
  return <Badge variant="outline">No record</Badge>;
}

export function Sf10ConfirmModal({
  requestId,
  adviserName,
  section,
  open,
  acting,
  onOpenChange,
  onConfirm,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<Sf10RecordForAdvisee[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setRecords(null);
      apiClient
        .get<RecordsResponse>(`/api/registrar/adviser-access-requests/${requestId}/records`)
        .then((res) => {
          if (!cancelled) setRecords(res.data.records);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load SF10 records (HTTP ${status})`
              : "Failed to load SF10 records",
          );
          console.error("[/api/registrar/adviser-access-requests/:id/records] fetch failed:", err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [open, requestId]);

  const missing = records?.filter((r) => r.record === null).length ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm SF10 records"
      className={styles.overlay}
      data-open={open ? "true" : "false"}
      onClick={(e) => {
        if (e.target === e.currentTarget && !acting) onOpenChange(false);
      }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.icon}>
            <FileCheck2 className={styles.iconSvg} />
          </span>
          <div>
            <h2 className={styles.title}>Confirm SF10 records</h2>
            <p className={styles.sub}>
              {adviserName} · {section} — verify these files before granting access.
            </p>
          </div>
        </header>

        {loading ? (
          <div className={styles.state}>
            <Loader2 className={styles.spin} />
            <p className={styles.stateText}>Loading advisee SF10 records…</p>
          </div>
        ) : error ? (
          <div className={styles.state}>
            <AlertTriangle className={styles.warnIcon} />
            <p className={styles.stateText}>{error}</p>
          </div>
        ) : records ? (
          <ul className={styles.list}>
            {records.map((r) => (
              <li key={r.lrn} className={styles.item}>
                <div className={styles.identity}>
                  <span className={styles.name}>{r.name}</span>
                  <span className={styles.lrn}>{r.lrn}</span>
                </div>
                <div className={styles.rec}>
                  {r.record ? (
                    <>
                      {statusBadge(r.record.status)}
                      <span className={styles.source}>
                        {r.record.source.replace(/_/g, " ")}
                      </span>
                      <span className={styles.version}>v{r.record.currentVersion}</span>
                    </>
                  ) : (
                    <span className={styles.missing}>
                      <FileX2 className={styles.missingIcon} />
                      No SF10 on file
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && missing > 0 ? (
          <p className={styles.note}>
            {missing} advisee{missing > 1 ? "s" : ""} have no SF10 record yet. You can
            still grant access, but those files will be unavailable to the adviser.
          </p>
        ) : null}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => onOpenChange(false)}
            disabled={acting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={acting || loading || !!error}
          >
            {acting ? "Approving…" : "Confirm & grant access"}
          </button>
        </footer>
      </div>
    </div>
  );
}
