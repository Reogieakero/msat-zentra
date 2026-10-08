import { CardModal } from "@/components/ui/CardModal";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-devices-table.module.css";

export function DeviceDetailsModal({
  row,
  onClose,
}: {
  row: AdmDeviceRow | null;
  onClose: () => void;
}) {
  return (
    <CardModal
      open={row !== null}
      onClose={onClose}
      title={row ? `${row.deviceType} with serial ${row.deviceSerial}` : "Device details"}
      description={row ? `Issued to ${row.student} (${row.lrn}).` : undefined}
      size="sm"
    >
      {row ? (
        <dl className={styles.modalRows}>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Student</dt>
            <dd className={styles.modalValue}>{row.student}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>LRN</dt>
            <dd className={`${styles.modalValue} ${styles.mono}`}>{row.lrn}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Grade</dt>
            <dd className={styles.modalValue}>{row.grade || "—"}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Status</dt>
            <dd className={styles.modalValue}>
              {row.status === "issued" ? "Issued" : "Returned"}
            </dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Issued by</dt>
            <dd className={styles.modalValue}>{row.issuedBy}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Date issued</dt>
            <dd className={styles.modalValue}>{row.issuedDate}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Returned</dt>
            <dd className={styles.modalValue}>{row.returnedDate ?? "—"}</dd>
          </div>
          <div className={styles.modalRow}>
            <dt className={styles.modalTerm}>Condition</dt>
            <dd className={styles.modalValue}>{row.conditionNotes ?? "—"}</dd>
          </div>
        </dl>
      ) : null}
    </CardModal>
  );
}
