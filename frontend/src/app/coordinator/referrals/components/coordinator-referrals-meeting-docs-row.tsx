"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  uploadMeetingAttachments,
  deleteMeetingAttachment,
} from "@/services/coordinator/cases.service";
import type { AdmMeeting } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-referrals-case-sheet.module.css";
export function MeetingDocsRow({
  meeting,
  onRefresh,
}: {
  meeting: Pick<AdmMeeting, "id" | "attachments">;
  onRefresh: () => void;
}) {
  const [picked, setPicked] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const docs = meeting.attachments ?? [];
  function pick(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (next.length === 0) {
      setError("Pick JPG, PNG, or WEBP images.");
      return;
    }
    setError(null);
    setPicked((prev) => [...prev, ...next].slice(0, 10));
  }
  async function upload() {
    if (picked.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMeetingAttachments(meeting.id, picked);
      setPicked([]);
      if (inputRef.current) inputRef.current.value = "";
      onRefresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }
  async function remove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    setError(null);
    try {
      await deleteMeetingAttachment(meeting.id, id);
      onRefresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }
  return (
    <div style={{ marginTop: "0.375rem" }}>
      {docs.length > 0 ? (
        <ul className={styles.evidenceList}>
          {docs.map((d) => (
            <li key={d.id} className={styles.evidenceItem}>
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.studentSub}
                style={{ margin: 0, minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={d.fileName}
              >
                {d.fileName}
              </a>
              <Button
                size="sm"
                variant="ghost"
                disabled={removingId === d.id}
                aria-busy={removingId === d.id || undefined}
                aria-label={`Remove ${d.fileName}`}
                onClick={() => void remove(d.id)}
              >
                {removingId === d.id ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Attach meeting documents"
          onChange={(e) => pick(e.target.files)}
          style={{ flex: 1, minWidth: "10rem" }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading || picked.length === 0}
          aria-busy={uploading || undefined}
          onClick={() => void upload()}
        >
          {uploading ? "Uploading…" : `Attach${picked.length > 0 ? ` (${picked.length})` : ""}`}
        </Button>
      </div>
      {error ? (
        <p className={styles.note} role="alert" style={{ margin: "0.25rem 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
