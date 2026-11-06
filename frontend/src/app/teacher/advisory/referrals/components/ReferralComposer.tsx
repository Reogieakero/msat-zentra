"use client";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sileo } from "@/components/ui/sonner";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import styles from "./ReferralComposer.module.css";
import {
  EMPTY_STAGES,
  groupByStudent,
  nextStep,
  type AnecdotalRecord,
  type StudentFolder,
} from "./referral-composer-data";
import { Step1RecordPicker } from "./step-1-record-picker";
import { Step2TrackPicker } from "./step-2-track-picker";
import { Step3ReceiverPicker } from "./step-3-receiver-picker";
import { Step4ReasonForm } from "./step-4-reason-form";
import { RecordConfirmModal } from "./record-confirm-modal";
interface ReferralComposerProps {
  referables: AnecdotalRecord[];
  admActiveLrns: string[];
  onCancel: () => void;
  onCreate: (draft: {
    anecdotalId: string;
    track: string;
    admReceiver: string | null;
    targetRole: string;
    reason: string;
  }) => Promise<{ id: string }>;
  onCreated: (referral: { id: string }, anecdotalId: string) => void;
}
export function ReferralComposer({ referables, admActiveLrns, onCancel, onCreate, onCreated }: ReferralComposerProps) {
  const [step, setStep] = useState(1);
  const [anecdotalId, setAnecdotalId] = useState<string | null>(null);
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(null);
  const [folderQuery, setFolderQuery] = useState("");
  const [track, setTrack] = useState<string | null>(null);
  const [admReceiver, setAdmReceiver] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<AnecdotalRecord | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const anecdotal = referables.find((a) => a.id === anecdotalId) ?? null;
  const studentFolders = useMemo(() => groupByStudent(referables), [referables]);
  const totalReferable = referables.filter((r) => !r.hasReferral).length;
  const admBlockedSet = useMemo(() => new Set(admActiveLrns), [admActiveLrns]);
  const admBlocked = anecdotal ? admBlockedSet.has(anecdotal.lrn) : false;
  const folderNeedle = folderQuery.trim().toLowerCase();
  const filteredFolders = useMemo(() => {
    if (!folderNeedle) return studentFolders;
    return studentFolders.filter(
      (f) =>
        f.studentName.toLowerCase().includes(folderNeedle) ||
        f.lrn.toLowerCase().includes(folderNeedle)
    );
  }, [studentFolders, folderNeedle]);
  const receiver = track === "adm" ? admReceiver : targetRole;
  const activeFolder = selectedStudentKey
    ? studentFolders.find((f) => f.key === selectedStudentKey) ?? null
    : null;
  function handleStudentClick(folder: StudentFolder) {
    setSelectedStudentKey(folder.key);
    setAnecdotalId(null);
    setError(null);
  }
  function handleRecordSelect(record: AnecdotalRecord) {
    if (record.hasReferral) {
      setError("That report already has a referral — pick another report.");
      return;
    }
    setPendingRecord(record);
    setError(null);
  }
  function handleModalClose() {
    setPendingRecord(null);
  }
  function handleModalView() {
    if (pendingRecord) setPreviewId(pendingRecord.id);
  }
  function handleModalContinue() {
    if (!pendingRecord || pendingRecord.hasReferral) return;
    setAnecdotalId(pendingRecord.id);
    setPendingRecord(null);
    setError(null);
    setStep(2);
  }
  function handleBackToStudents() {
    setSelectedStudentKey(null);
    setAnecdotalId(null);
  }
  function next() {
    if (step === 1) {
      if (!anecdotalId) {
        setError("Pick a student, then select one of their records.");
        return;
      }
      if (anecdotal?.hasReferral) {
        setError("That report already has a referral — pick another report.");
        return;
      }
    }
    if (step === 2 && !track) {
      setError("Choose whether this is an ADM case or another matter.");
      return;
    }
    if (step === 2 && track === "adm" && admBlocked) {
      setError("This student already has an open ADM case — only one ADM referral per student.");
      return;
    }
    if (step === 3 && !receiver) {
      setError("Choose who should receive this case.");
      return;
    }
    setError(null);
    setStep(nextStep(step));
  }
  async function handleSend() {
    if (!anecdotal || !receiver) {
      setError("Answer every question before sending.");
      return;
    }
    if (anecdotal.hasReferral) {
      setError("That report already has a referral — pick another report.");
      return;
    }
    if (!reason.trim()) {
      setError("Add a reason for the referral.");
      return;
    }
    if (track === "adm" && admBlocked) {
      setError("This student already has an open ADM case — only one ADM referral per student.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await onCreate({
        anecdotalId: anecdotal.id,
        track: track!,
        admReceiver,
        targetRole: track === "adm" ? "adm_coordinator" : targetRole!,
        reason: reason.trim(),
      });
      onCreated(created, anecdotal.id);
    } catch (err) {
      const message = apiErrorMessage(err, "Could not send this referral.");
      setError(message);
      sileo.error({ title: "Could not send referral", description: message });
    } finally {
      setSaving(false);
    }
  }
  function apiErrorMessage(err: unknown, fallback: string): string {
    if (typeof err === "object" && err !== null && "response" in err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        .response?.data?.error?.message;
      if (message) return message;
    }
    return fallback;
  }
  return (
    <div className={styles.canvas} aria-label="New referral">
      <div className={styles.canvasHead}>
        <div className={styles.canvasId}>
          <h2 className={styles.canvasTitle}>New referral</h2>
          <p className={styles.canvasSub}>
            Answer each question — your workflow fills in once the case is sent.
          </p>
        </div>
        <Badge variant="outline">Step {step} of 4</Badge>
      </div>
      <div className={styles.emptyFlow} aria-hidden>
        {EMPTY_STAGES.map((label) => (
          <span key={label} className={styles.emptyNode}>
            {label}
          </span>
        ))}
      </div>
      <div className={styles.body}>
        {step === 1 && (
          <Step1RecordPicker
            referables={referables}
            studentFolders={studentFolders}
            filteredFolders={filteredFolders}
            totalReferable={totalReferable}
            activeFolder={activeFolder}
            anecdotalId={anecdotalId}
            admBlockedSet={admBlockedSet}
            folderQuery={folderQuery}
            setFolderQuery={setFolderQuery}
            onStudentClick={handleStudentClick}
            onRecordSelect={handleRecordSelect}
            onBackToStudents={handleBackToStudents}
          />
        )}
        {step === 2 && (
          <Step2TrackPicker
            track={track}
            setTrack={setTrack}
            setAdmReceiver={setAdmReceiver}
            setTargetRole={setTargetRole}
            setError={setError}
            admBlocked={admBlocked}
            anecdotal={anecdotal}
          />
        )}
        {step === 3 && (
          <Step3ReceiverPicker
            track={track}
            admReceiver={admReceiver}
            setAdmReceiver={setAdmReceiver}
            targetRole={targetRole}
            setTargetRole={setTargetRole}
            setError={setError}
            anecdotal={anecdotal}
          />
        )}
        {step === 4 && (
          <Step4ReasonForm
            reason={reason}
            setReason={setReason}
            anecdotal={anecdotal}
            receiver={receiver}
            track={track}
          />
        )}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
      <div className={styles.footer}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className={styles.footerNav}>
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button type="button" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={handleSend} disabled={saving} aria-busy={saving || undefined}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Sending referral…
                </>
              ) : (
                "Send referral"
              )}
            </Button>
          )}
        </div>
      </div>
      <RecordConfirmModal
        pendingRecord={pendingRecord}
        previewId={previewId}
        onClose={handleModalClose}
        onView={handleModalView}
        onContinue={handleModalContinue}
      />
      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}
