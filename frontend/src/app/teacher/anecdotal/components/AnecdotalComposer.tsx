"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  MOCK_ANECDOTAL_STUDENTS,
  humanize,
  type MockAnecdotalCategory,
} from "./anecdotal-workspace-mock";
import styles from "./AnecdotalComposer.module.css";

const CATEGORIES: MockAnecdotalCategory[] = [
  "behavioral",
  "bullying",
  "academic",
  "attendance",
  "health",
];

const TIERS = ["Restricted", "Confidential"] as const;

export interface NewAnecdotalInput {
  studentId: string;
  studentName: string;
  observationDate: string;
  category: MockAnecdotalCategory;
  tier: "Restricted" | "Confidential";
  location: string;
  incident: string;
  notes: string;
}

interface AnecdotalComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: NewAnecdotalInput) => void;
}

export function AnecdotalComposer({ open, onOpenChange, onSave }: AnecdotalComposerProps) {
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<MockAnecdotalCategory | "">("");
  const [tier, setTier] = useState<"Restricted" | "Confidential" | "">("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [incident, setIncident] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStudentId("");
    setCategory("");
    setTier("");
    setDate("");
    setLocation("");
    setIncident("");
    setNotes("");
    setError(null);
  }

  function handleSave() {
    const student = MOCK_ANECDOTAL_STUDENTS.find((s) => s.id === studentId);
    if (!student || !category || !tier || !date || !incident.trim()) {
      setError("Student, category, tier, date, and the incident write-up are required.");
      return;
    }
    const input: NewAnecdotalInput = {
      studentId: student.id,
      studentName: student.name,
      observationDate: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      category,
      tier,
      location: location.trim() || "Classroom",
      incident: incident.trim(),
      notes: notes.trim(),
    };
    onSave(input);
    reset();
    onOpenChange(false);
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
          <DialogTitle>New anecdotal record</DialogTitle>
          <DialogDescription>
            Write up what happened. Mock only — nothing is saved to the backend.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.fields}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <Label htmlFor="anec-student">Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="anec-student" className={styles.control}>
                  <SelectValue placeholder="Select advisee" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_ANECDOTAL_STUDENTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.lrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={styles.field}>
              <Label htmlFor="anec-date">Date observed</Label>
              <Input
                id="anec-date"
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <Label htmlFor="anec-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as MockAnecdotalCategory)}>
                <SelectTrigger id="anec-category" className={styles.control}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {humanize(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={styles.field}>
              <Label htmlFor="anec-tier">Confidentiality</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as "Restricted" | "Confidential")}>
                <SelectTrigger id="anec-tier" className={styles.control}>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={styles.field}>
            <Label htmlFor="anec-location">Location</Label>
            <Input
              id="anec-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Classroom"
            />
          </div>

          <div className={styles.field}>
            <Label htmlFor="anec-incident">What happened</Label>
            <Textarea
              id="anec-incident"
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              placeholder="Describe the incident factually…"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className={styles.field}>
            <Label htmlFor="anec-notes">Notes / recommendations (optional)</Label>
            <Textarea
              id="anec-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Next steps, monitoring, referrals…"
              rows={2}
              maxLength={2000}
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            File record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
