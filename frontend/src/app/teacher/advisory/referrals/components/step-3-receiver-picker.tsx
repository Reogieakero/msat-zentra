"use client";
import { MessagesSquare } from "lucide-react";
import styles from "./ReferralComposer.module.css";
import {
  ADM_RECEIVER_ICONS,
  ADM_RECEIVER_LABELS,
  TARGET_ICONS,
  TARGET_ROLE_LABELS,
  type AnecdotalRecord,
} from "./referral-composer-data";
interface Props {
  track: string | null;
  admReceiver: string | null;
  setAdmReceiver: (v: string) => void;
  targetRole: string | null;
  setTargetRole: (v: string) => void;
  setError: (v: string | null) => void;
  anecdotal: AnecdotalRecord | null;
}
export function Step3ReceiverPicker({
  track,
  admReceiver,
  setAdmReceiver,
  targetRole,
  setTargetRole,
  setError,
  anecdotal,
}: Props) {
  return (
    <fieldset className={styles.question}>
      <legend className={styles.prompt}>
        Who should receive {anecdotal ? `${anecdotal.studentName}'s` : "this"} case?
      </legend>
      {track === "adm" ? (
        <p className={styles.trackHint}>
          ADM cases route first to the consultation reviewer — the School
          Nurse, Guidance Counselor, or LRPC — then enter the ADM pipeline
          for Coordinator certification.
        </p>
      ) : null}
      <div className={styles.roleGrid}>
        {(track === "adm" ? Object.keys(ADM_RECEIVER_LABELS) : Object.keys(TARGET_ROLE_LABELS)).map(
          (role) => {
            const label =
              track === "adm"
                ? ADM_RECEIVER_LABELS[role]
                : TARGET_ROLE_LABELS[role];
            const Icon =
              track === "adm"
                ? (ADM_RECEIVER_ICONS[role] ?? MessagesSquare)
                : (TARGET_ICONS[role] ?? MessagesSquare);
            const selected = track === "adm" ? admReceiver === role : targetRole === role;
            const onSelect = () => {
              if (track === "adm") setAdmReceiver(role);
              else setTargetRole(role);
              setError(null);
            };
            return (
              <button
                key={role}
                type="button"
                aria-pressed={selected}
                className={`${styles.role} ${selected ? styles.roleSelected : ""}`}
                onClick={onSelect}
              >
                <span className={styles.roleTile} aria-hidden>
                  <Icon />
                </span>
                <span className={styles.roleLabel}>{label}</span>
              </button>
            );
          }
        )}
      </div>
    </fieldset>
  );
}
