"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import styles from "./ReferralComposer.module.css";
import { CATEGORY_LABELS, truncate, type AnecdotalRecord } from "./referral-composer-data";
interface Props {
  pendingRecord: AnecdotalRecord | null;
  previewId: string | null;
  onClose: () => void;
  onView: () => void;
  onContinue: () => void;
}
export function RecordConfirmModal({ pendingRecord, previewId, onClose, onView, onContinue }: Props) {
  return (
    <CardModal
      open={pendingRecord !== null && previewId === null}
      onClose={onClose}
      size="md"
      title={
        pendingRecord
          ? `${CATEGORY_LABELS[pendingRecord.category] ?? pendingRecord.category} report — ${pendingRecord.studentName}`
          : "Report"
      }
      description={
        pendingRecord
          ? `Observed ${pendingRecord.observationDate} · LRN ${pendingRecord.lrn} · ${pendingRecord.section}`
          : "Choose what to do with this report."
      }
      watchKey={pendingRecord?.id}
    >
      {pendingRecord ? (
        <div className={styles.choiceSummary}>
          <p className={styles.choiceExcerpt}>
            “{truncate(pendingRecord.excerpt, 160)}”
          </p>
          <Badge variant="outline">Ready to refer</Badge>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onView}>
          View anecdotal
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </CardModal>
  );
}
