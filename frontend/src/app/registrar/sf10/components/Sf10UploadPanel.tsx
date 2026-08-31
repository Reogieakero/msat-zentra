"use client";

import * as React from "react";
import { UploadCloud, FileUp, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { fetchRegistrarStudents, type UploadableStudent } from "../api";
import styles from "../sf10.module.css";

export function Sf10UploadPanel({
  onUpload,
  uploading,
}: {
  onUpload: (studentId: string, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [studentId, setStudentId] = React.useState<string>("");
  const [students, setStudents] = React.useState<UploadableStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = React.useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetchRegistrarStudents(controller.signal)
      .then(setStudents)
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        console.error("[/api/registrar/students] failed:", err);
      })
      .finally(() => setLoadingStudents(false));
    return () => controller.abort();
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) setFile(files[0]);
  };

  const canSubmit = !!file && !!studentId && !uploading;

  const handleUpload = async () => {
    if (!canSubmit || !file) return;
    try {
      await onUpload(studentId, file);
      const student = students.find((s) => s.studentId === studentId);
      toast.success({
        title: "SF10 uploaded",
        description: `${file.name} attached for ${student?.fullName ?? "student"}.`,
      });
      setFile(null);
      setStudentId("");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      toast.error({ title: "Upload failed", description: "Could not attach the SF10 file." });
    }
  };

  const selectedStudent = students.find((s) => s.studentId === studentId);

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
          {file ? <FileUp /> : <UploadCloud />}
        </span>
        <p className={styles.dropTitle}>
          {file ? file.name : "Drag & drop SF10 file"}
        </p>
        <p className={styles.dropHint}>PDF, JPG or PNG · or click to browse</p>
      </div>

      <div className={styles.uploadBody}>
        <div>
          <label className={styles.fieldLabel} htmlFor="sf10-student">
            Student
          </label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id="sf10-student" className={styles.search}>
              <SelectValue
                placeholder={loadingStudents ? "Loading students…" : "Select student by LRN"}
              />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.studentId} value={s.studentId}>
                  {s.fullName} · {s.lrn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStudent ? (
            <p className={styles.fieldHint}>
              {selectedStudent.gradeLevel} · {selectedStudent.section}
            </p>
          ) : null}
        </div>

        <div className={styles.uploadActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={styles.uploadActions}
            onClick={() => {
              setFile(null);
              setStudentId("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={!file && !studentId}
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
