"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

import styles from "./sf10.module.css";

export function Sf10UploadPanel({
  onUpload,
}: {
  onUpload: (file: File) => Promise<void>;
}) {
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
    <section className={assign.card} aria-labelledby="sf10-upload">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 id="sf10-upload" className="text-base font-semibold">
          Upload SF10
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach an SF10 file (PDF, JPG or PNG). Learner matching via OCR
          lands in a future build.
        </p>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""} relative`}
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
        aria-label="Attach SF10 file"
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

      <div className={`${styles.uploadActions} relative`}>
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
        >
          {uploading ? "Uploading…" : "Upload & attach"}
        </Button>
      </div>
    </section>
  );
}
