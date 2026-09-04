"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { enlistStudent } from "./advisory-students-data";
import styles from "./AddStudentDialog.module.css";

function apiMessage(e: unknown, fallback: string): string {
  if (typeof e !== "object" || e === null) return fallback;
  const response = (e as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return fallback;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : fallback;
}

interface AddStudentDialogProps {
  open: boolean;
  sectionName: string;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentDialog({ open, sectionName, onOpenChange }: AddStudentDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [lrn, setLrn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setLrn("");
    setError(null);
  }

  async function handleSave() {
    if (!name.trim() || !lrn.trim()) {
      setError("Fill in the full name and LRN.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await enlistStudent({ fullName: name.trim(), lrn: lrn.trim() });
      queryClient.invalidateQueries({ queryKey: ["advisory-students"] });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(apiMessage(e, "Could not enlist the student. Try again."));
    } finally {
      setSaving(false);
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
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>
            Enlist a student to {sectionName || "your advisory section"}. They appear in
            your roster right away; full records unlock once they register and the
            account is approved.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.fields}>
          <div className={styles.field}>
            <Label htmlFor="add-name">Full name</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jose Ramos"
            />
          </div>
          <div className={styles.field}>
            <Label htmlFor="add-lrn">LRN</Label>
            <Input
              id="add-lrn"
              value={lrn}
              onChange={(e) => setLrn(e.target.value)}
              placeholder="e.g. 201234567810"
              inputMode="numeric"
            />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Enlisting…" : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
