"use client";

import * as React from "react";
import { UploadCloud, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import styles from "../sf10.module.css";

export function Sf10UploadPanel({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) setFile(files[0]);
  };

  const canSubmit = !!file && !uploading;

  const handleUpload = async () => {
    if (!canSubmit || !file) return;
    setUploading(true);
    try {
      await onUpload(file);
      toast.success({
        title: "SF10 uploaded",
        description: `${file.name} attached to the registry.`,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      toast.error({ title: "Upload failed", description: "Could not attach the SF10 file." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Upload SF10</h3>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className={styles.fileInput}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className={styles.dropIcon}>
          <UploadCloud />
        </span>
        <p className={styles.dropTitle}>{file ? file.name : "Drag & drop SF10 file"}</p>
        <p className={styles.dropHint}>PDF, JPG or PNG · or click to browse</p>
      </div>

      <div className={styles.uploadBody}>
        <div className={styles.uploadActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={!file}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleUpload}
            disabled={!canSubmit}
            className="gap-1.5"
          >
            <Paperclip />
            {uploading ? "Uploading…" : "Upload & attach"}
          </Button>
        </div>
      </div>
    </div>
  );
}
