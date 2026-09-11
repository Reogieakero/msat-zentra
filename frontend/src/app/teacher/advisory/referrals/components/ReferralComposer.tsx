"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Landmark,
  MessagesSquare,
  Stethoscope,
} from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import styles from "./ReferralComposer.module.css";

const TARGET_ICONS: Record<string, typeof MessagesSquare> = {
  guidance_counselor: MessagesSquare,
  nurse: Stethoscope,
  adm_coordinator: ClipboardList,
  principal: Landmark,
};

const TRACK_OPTIONS: { key: string; label: string; icon: typeof MessagesSquare }[] = [
  { key: "adm", label: "ADM case", icon: Landmark },
  { key: "general", label: "Other matter", icon: MessagesSquare },
];

const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

const EMPTY_STAGES = ["Referred", "Review", "Parent meeting", "Home visit", "Resolved"];

const ADM_RECEIVER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};

const ADM_RECEIVER_ICONS: Record<string, typeof MessagesSquare> = {
  nurse: Stethoscope,
  guidance_counselor: MessagesSquare,
  lrpc: Landmark,
};

const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

const CATEGORY_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};

function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t || "anecdotal record";
}

interface AnecdotalRecord {
  id: string;
  observationDate: string;
  studentId?: string;
  studentName: string;
  section: string;
  lrn: string;
  category: string;
  excerpt: string;
  hasReferral?: boolean;
  referralCount?: number;
  hasAccount?: boolean;
}

interface ReferralComposerProps {
  referables: AnecdotalRecord[];
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

function nextStep(step: number): number {
  return Math.min(4, step + 1);
}

// Inline new-referral questionnaire rendered inside the workflow card. The
// workflow above stays empty until the case is sent, then it fills in.
// One folder per student with anecdotal records; clicking a folder drills
// into that student's reports so the user can pick which one to refer.
// Already-referred reports stay visible but disabled.
interface StudentFolder {
  key: string;
  studentId: string;
  studentName: string;
  lrn: string;
  section: string;
  records: AnecdotalRecord[];
  referableCount: number;
}

function groupByStudent(records: AnecdotalRecord[]): StudentFolder[] {
  const map = new Map<string, StudentFolder>();
  for (const r of records) {
    const key = r.studentId ?? r.lrn ?? `${r.studentName} · ${r.lrn}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        studentId: r.studentId ?? r.lrn ?? key,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section,
        records: [],
        referableCount: 0,
      });
    }
    const folder = map.get(key)!;
    folder.records.push(r);
    if (!r.hasReferral) folder.referableCount += 1;
    // Keep folder header representative when records disagree (e.g. section change).
    if (!folder.studentName && r.studentName) folder.studentName = r.studentName;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName)
  );
}

export function ReferralComposer({ referables, onCancel, onCreate, onCreated }: ReferralComposerProps) {
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
    // Open the view-or-continue modal instead of selecting immediately so
    // the teacher can preview the anecdotal before committing to it.
    // Records for students without accounts can still be previewed —
    // only continuing to a referral requires an account.
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
    } finally {
      setSaving(false);
    }
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
          <fieldset className={styles.question}>
            <legend className={`${styles.prompt} ${styles.promptRow}`}>
              <span>Which student and anecdotal record is this referral from?</span>
              {activeFolder ? (
                <Button type="button" variant="outline" size="sm" onClick={handleBackToStudents}>
                  Back to students
                </Button>
              ) : null}
            </legend>
            {referables.length === 0 ? (
              <p className={styles.empty}>
                No anecdotal records yet — file an anecdotal record first.
              </p>
            ) : (
              <>
                {totalReferable === 0 ? (
                  <p className={styles.notice}>
                    Every record already has a referral — file a new anecdotal to refer again.
                    You can still open a student to review their reports.
                  </p>
                ) : null}
                {!activeFolder ? (
                  <>
                    {studentFolders.length > 1 ? (
                      <div className={styles.folderSearch}>
                        <input
                          type="search"
                          className={styles.folderSearchInput}
                          placeholder="Search student or LRN…"
                          value={folderQuery}
                          onChange={(e) => setFolderQuery(e.target.value)}
                          aria-label="Search students with anecdotal records"
                        />
                        <span className={styles.folderCount}>
                          {filteredFolders.length} of {studentFolders.length} students ·{" "}
                          {totalReferable} referable
                        </span>
                      </div>
                    ) : (
                      <span className={styles.folderCount}>
                        {studentFolders.length} student{studentFolders.length !== 1 ? "s" : ""} ·{" "}
                        {totalReferable} referable
                      </span>
                    )}
                    {filteredFolders.length === 0 ? (
                      <p className={styles.empty}>
                        No students match “{folderQuery.trim()}”.
                      </p>
                    ) : (
                      <div className={styles.folderGrid}>
                        {filteredFolders.map((folder) => {
                          const allReferred = folder.referableCount === 0;
                          return (
                            <button
                              key={folder.key}
                              type="button"
                              className={`${styles.folderPick} ${allReferred ? styles.folderPickDisabled : ""}`}
                              onClick={() => handleStudentClick(folder)}
                              aria-label={`Open ${folder.studentName}'s reports (${folder.referableCount} of ${folder.records.length} referable)`}
                            >
                              <FolderCard
                                label={folder.studentName}
                                sublabel={`LRN ${folder.lrn} · ${folder.section}`}
                                files={folder.records.map((r) => ({
                                  name: CATEGORY_LABELS[r.category] ?? r.category,
                                  tag: `observed ${r.observationDate}`,
                                  tone: CATEGORY_TONES[r.category] ?? 1,
                                  icon: "doc",
                                }))}
                              />
                              <span className={styles.folderStatus}>
                                {allReferred ? (
                                  <Badge variant="secondary">All referred</Badge>
                                ) : (
                                  <Badge variant="outline">
                                    {folder.referableCount} of {folder.records.length} referable
                                  </Badge>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.recordGrid}>
                    <p className={styles.recordHeading}>
                      {activeFolder.studentName} · LRN {activeFolder.lrn} — pick which report to
                      refer ({activeFolder.referableCount} of {activeFolder.records.length}{" "}
                      referable)
                    </p>
                    {activeFolder.records
                      .slice()
                      .sort((a, b) => {
                        // Referable reports first, then newest.
                        if (!!a.hasReferral !== !!b.hasReferral) return a.hasReferral ? 1 : -1;
                        return (b.observationDate ?? "").localeCompare(a.observationDate ?? "");
                      })
                      .map((r) => {
                        const selected = r.id === anecdotalId;
                        // Already-referred reports stay unclickable.
                        const disabled = !!r.hasReferral;
                        const title = r.hasReferral
                          ? "This report already has a referral"
                          : `Refer this ${CATEGORY_LABELS[r.category] ?? r.category} report`;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            aria-pressed={selected}
                            disabled={disabled}
                            aria-disabled={disabled}
                            title={title}
                            className={`${styles.folderPick} ${selected ? styles.folderPickSelected : ""} ${disabled ? styles.folderPickDisabled : ""}`}
                            onClick={() => handleRecordSelect(r)}
                          >
                            <FolderCard
                              label={CATEGORY_LABELS[r.category] ?? r.category}
                              sublabel={`observed ${r.observationDate}`}
                              files={[
                                {
                                  name: truncate(r.excerpt, 28),
                                  tag: `${activeFolder.studentName} · ${activeFolder.lrn}`,
                                  tone: CATEGORY_TONES[r.category] ?? 1,
                                  icon: "doc",
                                },
                              ]}
                            />
                            <span className={styles.folderStatus}>
                              {disabled ? (
                                <Badge variant="secondary">Already referred</Badge>
                              ) : selected ? (
                                <Badge variant="default">Selected</Badge>
                              ) : (
                                <Badge variant="outline">Ready to refer</Badge>
                              )}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className={styles.question}>
            <legend className={styles.prompt}>
              Is this for an ADM case or another matter?
            </legend>
            <div className={styles.trackGrid}>
              {TRACK_OPTIONS.map((t) => {
                const Icon = t.icon;
                const selected = track === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={selected}
                    className={`${styles.role} ${selected ? styles.roleSelected : ""}`}
                    onClick={() => {
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
        )}

        {step === 3 && (
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
        )}

        {step === 4 && (
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
            <Button type="button" onClick={handleSend} disabled={saving}>
              {saving ? "Sending…" : "Send referral"}
            </Button>
          )}
        </div>
      </div>

      {/* Pick-a-report choice: preview the anecdotal or continue with it. */}
      <Dialog
        open={pendingRecord !== null && previewId === null}
        onOpenChange={(open) => {
          if (!open) handleModalClose();
        }}
      >
        <DialogContent className={styles.choiceDialog}>
          <DialogHeader>
            <DialogTitle>
              {pendingRecord
                ? `${CATEGORY_LABELS[pendingRecord.category] ?? pendingRecord.category} report — ${pendingRecord.studentName}`
                : "Report"}
            </DialogTitle>
            <DialogDescription>
              {pendingRecord
                ? `Observed ${pendingRecord.observationDate} · LRN ${pendingRecord.lrn} · ${pendingRecord.section}`
                : "Choose what to do with this report."}
            </DialogDescription>
          </DialogHeader>
          {pendingRecord ? (
            <div className={styles.choiceSummary}>
              <p className={styles.choiceExcerpt}>
                “{truncate(pendingRecord.excerpt, 160)}”
              </p>
              <Badge variant="outline">Ready to refer</Badge>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleModalView}>
              View anecdotal
            </Button>
            <Button type="button" onClick={handleModalContinue}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}