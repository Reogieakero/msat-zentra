"use client";
import styles from "./ReferralComposer.module.css";
import { TRACK_OPTIONS, type AnecdotalRecord } from "./referral-composer-data";
interface Props {
  track: string | null;
  setTrack: (v: string) => void;
  setAdmReceiver: (v: string | null) => void;
  setTargetRole: (v: string | null) => void;
  setError: (v: string | null) => void;
  admBlocked: boolean;
  anecdotal: AnecdotalRecord | null;
}
export function Step2TrackPicker({
  track,
  setTrack,
  setAdmReceiver,
  setTargetRole,
  setError,
  admBlocked,
  anecdotal,
}: Props) {
  return (
    <fieldset className={styles.question}>
      <legend className={styles.prompt}>
        Is this for an ADM case or another matter?
      </legend>
      {admBlocked ? (
        <p className={styles.notice}>
          {anecdotal?.studentName ?? "This student"} already has an open
          ADM case — only one ADM referral per student. Choose another
          matter, or pick a different student.
        </p>
      ) : null}
      <div className={styles.trackGrid}>
        {TRACK_OPTIONS.map((t) => {
          const Icon = t.icon;
          const selected = track === t.key;
          const disabled = t.key === "adm" && admBlocked;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              aria-disabled={disabled}
              title={disabled ? "This student already has an open ADM case" : undefined}
              className={`${styles.role} ${selected ? styles.roleSelected : ""} ${disabled ? styles.roleDisabled : ""}`}
              onClick={() => {
                if (disabled) {
                  setError("This student already has an open ADM case — only one ADM referral per student.");
                  return;
                }
                setTrack(t.key);
                setAdmReceiver(null);
                setTargetRole(null);
                setError(null);
              }}
            >
              <span className={styles.roleTile} aria-hidden>
                <Icon />
              </span>
              <span className={styles.roleLabel}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.trackHint}>
        ADM = Alternate Delivery Mode (module-based pathway). Other matter =
        behavior, health, bullying, academics, etc.
      </p>
    </fieldset>
  );
}
