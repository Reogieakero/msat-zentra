"use client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import styles from "./ReferralComposer.module.css";
import { TARGET_ROLE_LABELS, type AnecdotalRecord } from "./referral-composer-data";
interface Props {
  reason: string;
  setReason: (v: string) => void;
  anecdotal: AnecdotalRecord | null;
  receiver: string | null;
  track: string | null;
}
export function Step4ReasonForm({ reason, setReason, anecdotal, receiver, track }: Props) {
  return (
    <div className={styles.question}>
      <Label htmlFor="composer-reason" className={styles.prompt}>
        Why is {anecdotal?.studentName ?? "this student"} being referred
        to {receiver ? (track === "adm" ? "the ADM Coordinator" : TARGET_ROLE_LABELS[receiver] ?? receiver) : "them"}?
      </Label>
      <Textarea
        id="composer-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Give the receiving role the context they need…"
        rows={4}
      />
      {anecdotal && (
        <p className={styles.recap}>
          From {anecdotal.studentName} · {anecdotal.section} · observed{" "}
          {anecdotal.observationDate}
        </p>
      )}
    </div>
  );
}
