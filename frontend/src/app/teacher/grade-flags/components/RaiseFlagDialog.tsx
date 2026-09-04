"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  REASON_LABELS,
  raiseFlag,
  type FlagOptions,
  type FlagReason,
} from "./grade-flags-data";
import styles from "./RaiseFlagDialog.module.css";

const REASONS = Object.keys(REASON_LABELS) as FlagReason[];

interface RaiseFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: FlagOptions | null;
  onRaised: () => void;
}

export function RaiseFlagDialog({ open, onOpenChange, options, onRaised }: RaiseFlagDialogProps) {
  const [classKey, setClassKey] = useState("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<FlagReason | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () =>
      options?.classes.find(
        (c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === classKey
      ) ?? null,
    [options, classKey]
  );

  const students = useMemo(() => {
    if (!options || !selectedClass) return [];
    return options.students.filter((s) => s.sectionId === selectedClass.sectionId);
  }, [options, selectedClass]);

  function reset() {
    setClassKey("");
    setStudentId("");
    setReason("");
    setNote("");
    setError(null);
  }

  async function handleSubmit() {
    if (!selectedClass || !studentId || !reason) {
      setError("Choose a class, student, and reason.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await raiseFlag({
        studentId,
        subjectId: selectedClass.subjectId,
        sectionId: selectedClass.sectionId,
        termId: selectedClass.termId,
        reason,
        note: note.trim() ? note.trim() : undefined,
      });
      reset();
      onOpenChange(false);
      onRaised();
    } catch {
      setError("Could not raise the flag. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>Raise a grade flag</DialogTitle>
          <DialogDescription>
            Flag a student&apos;s grade for review by the gradebook owner.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.fields}>
          <div className={styles.field}>
            <Label htmlFor="flag-class">Class</Label>
            <Select
              value={classKey}
              onValueChange={(v) => {
                setClassKey(v);
                setStudentId("");
              }}
            >
              <SelectTrigger id="flag-class" className={styles.control}>
                <SelectValue placeholder="Select subject · section" />
              </SelectTrigger>
              <SelectContent>
                {options?.classes.map((c) => (
                  <SelectItem
                    key={`${c.subjectId}|${c.sectionId}|${c.termId}`}
                    value={`${c.subjectId}|${c.sectionId}|${c.termId}`}
                  >
                    {c.subjectName} · {c.sectionName} · Term {c.termNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.field}>
            <Label htmlFor="flag-student">Student</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={!selectedClass}>
              <SelectTrigger id="flag-student" className={styles.control}>
                <SelectValue placeholder={selectedClass ? "Select student" : "Pick a class first"} />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.lrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.field}>
            <Label htmlFor="flag-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as FlagReason)}>
              <SelectTrigger id="flag-reason" className={styles.control}>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.field}>
            <Label htmlFor="flag-note">Note (optional)</Label>
            <Textarea
              id="flag-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should the gradebook owner check?"
              rows={3}
              maxLength={2000}
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Raising…" : "Raise flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
