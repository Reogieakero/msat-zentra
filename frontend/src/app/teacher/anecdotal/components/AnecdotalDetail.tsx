"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_COLORS,
  humanize,
  type MockAnecdotalRecord,
} from "./anecdotal-workspace-mock";
import styles from "./AnecdotalDetail.module.css";

interface AnecdotalDetailProps {
  record: MockAnecdotalRecord | null;
  onClose: () => void;
  onFollowup: (recordId: string, notes: string) => void;
}

export function AnecdotalDetail({ record, onClose, onFollowup }: AnecdotalDetailProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setNotes("");
    setError(null);
    onClose();
  }

  function handleAdd() {
    if (!record) return;
    if (!notes.trim()) {
      setError("Write the follow-up notes first.");
      return;
    }
    onFollowup(record.id, notes.trim());
    setNotes("");
    setError(null);
  }

  return (
    <Dialog
      open={record !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className={styles.dialog}>
        {record ? (
          <>
            <DialogHeader>
              <div className={styles.titleRow}>
                <DialogTitle className={styles.title}>{record.studentName}</DialogTitle>
                <Badge
                  variant="outline"
                  className={styles.categoryBadge}
                  style={{ "--record": CATEGORY_COLORS[record.category] } as React.CSSProperties}
                >
                  {humanize(record.category)}
                </Badge>
              </div>
              <DialogDescription className={styles.subtitle}>
                {record.observationDate} · {record.location} · {record.tier}
                {record.referred ? ` · Referred to ${record.referralTarget ?? "—"}` : ""}
              </DialogDescription>
            </DialogHeader>

            <p className={styles.incident}>{record.incident}</p>
            {record.notes ? <p className={styles.notes}>{record.notes}</p> : null}

            <div className={styles.followups}>
              <p className={styles.sectionTitle}>
                Follow-ups ({record.followups.length})
              </p>
              {record.followups.length === 0 ? (
                <p className={styles.noFollowups}>No follow-ups yet.</p>
              ) : (
                <ul className={styles.followupList}>
                  {record.followups.map((f) => (
                    <li key={f.id} className={styles.followup}>
                      <span className={styles.followupHead}>
                        {f.by} · {f.date}
                      </span>
                      <span className={styles.followupNotes}>{f.notes}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.field}>
                <Label htmlFor="followup-notes">Add follow-up</Label>
                <Textarea
                  id="followup-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened since?"
                  rows={2}
                  maxLength={2000}
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <Button type="button" size="sm" onClick={handleAdd} className={styles.addBtn}>
                Add follow-up
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
