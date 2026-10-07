import * as React from "react";
import { Check, Loader2, X, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardModal } from "@/components/ui/CardModal";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, type PendingStudent } from "./types";
import { formatGrade } from "@/lib/utils";
import { LrnVerification } from "./LrnVerification";
import styles from "./student-profile-card.module.css";

type Props = {
  student: PendingStudent | null;
  acting: string | null;
  onActed: (id: string, approved: boolean, reason?: string) => void;
  onClose?: () => void;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function StudentProfileCard({ student, acting, onActed, onClose }: Props) {
  const [dialog, setDialog] = React.useState<null | "approve" | "reject">(null);
  const [reason, setReason] = React.useState("");

  if (!student) {
    return (
      <div className={styles.empty}>
        <UserRound className={styles.emptyIcon} />
        <p className={styles.emptyText}>Select a student from the list →</p>
      </div>
    );
  }

  const isActing = acting === student.id;
  const closeDialog = () => {
    setDialog(null);
    setReason("");
  };
  const confirmApprove = () => {
    onActed(student.id, true);
    closeDialog();
  };
  const confirmReject = () => {
    if (!reason.trim()) return;
    onActed(student.id, false, reason.trim());
    closeDialog();
  };

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <Badge variant="warning" className={styles.statusBadge}>
            {student.status}
          </Badge>
          {onClose ? (
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Close profile"
              onClick={onClose}
            >
              <X className={styles.closeIcon} />
            </button>
          ) : null}
        </div>
        <Avatar size="lg" className={styles.avatar}>
          {student.imageUrl ? (
            <AvatarImage src={student.imageUrl} alt={student.name} />
          ) : null}
          <AvatarFallback className={styles.avatarFallback}>
            {initials(student.name)}
          </AvatarFallback>
        </Avatar>
        <div className={styles.identity}>
          <h2 className={styles.name}>{student.name}</h2>
          <p className={styles.lrn}>{student.lrn}</p>
        </div>
      </header>

      <dl className={styles.grid}>
        <Field label="Grade Level" value={formatGrade(student.gradeLevel)} />
        <Field label="Section" value={student.section} />
        <Field label="Email" value={student.email} />
        <Field label="Contact Number" value={student.contactNumber} />
        <Field label="Birthdate" value={student.birthdate} />
        <Field label="Address" value={student.address} />
        <Field label="Requested" value={formatRelativeTime(student.requestedAt)} span />
      </dl>

      <LrnVerification lrn={student.lrn} name={student.name} />

      <footer className={styles.actions}>
        <Button
          variant="default"
          size="sm"
          className={styles.approve}
          disabled={isActing}
          aria-busy={isActing || undefined}
          onClick={() => setDialog("approve")}
        >
          {isActing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className={styles.actionIcon} />
          )}
          {isActing ? "Processing…" : "Approve"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={styles.reject}
          disabled={isActing}
          onClick={() => setDialog("reject")}
        >
          <X className={styles.actionIcon} />
          Reject
        </Button>
      </footer>

      <CardModal
        open={dialog !== null}
        onClose={() => {
          if (!isActing) closeDialog();
        }}
        dismissable={!isActing}
        size="sm"
        title={dialog === "approve" ? "Approve account" : "Reject account"}
        description={
          dialog === "approve" ? (
            <>
              Approve <strong>{student.name}</strong> ({student.lrn})? They will be
              notified that their account is active.
            </>
          ) : (
            <>
              Reject <strong>{student.name}</strong> ({student.lrn})? Add a reason for
              the rejection.
            </>
          )
        }
      >
          {dialog === "reject" ? (
            <div className={styles.dialogBody}>
              <Textarea
                placeholder="Reason for rejection (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={styles.reasonInput}
              />
            </div>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={closeDialog} disabled={isActing}>
              Cancel
            </Button>
            {dialog === "approve" ? (
              <Button
                variant="default"
                onClick={confirmApprove}
                disabled={isActing}
                aria-busy={isActing || undefined}
              >
                {isActing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isActing ? "Approving…" : "Confirm approve"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={isActing || !reason.trim()}
                aria-busy={isActing || undefined}
              >
                {isActing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isActing ? "Rejecting…" : "Confirm reject"}
              </Button>
            )}
          </div>
      </CardModal>
    </article>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={`${styles.field} ${span ? styles.fieldWide : ""}`}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{value}</dd>
    </div>
  );
}
