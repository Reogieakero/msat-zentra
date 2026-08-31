"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sf10Repository } from "./components/Sf10Repository";
import { Sf10UploadPanel } from "./components/Sf10UploadPanel";
import { Sf10DetailSheet } from "./components/Sf10DetailSheet";
import { fetchSf10Records, uploadSf10 } from "./api";
import type { Sf10Record, Sf10Status } from "./types";
import styles from "./sf10.module.css";

const STATUS_FILTERS: Array<{ value: Sf10Status | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "attach", label: "Attached" },
  { value: "available", label: "Available" },
  { value: "released", label: "Released" },
];

const GRADE_FILTERS: Array<{ value: "G11" | "G12" | "all"; label: string }> = [
  { value: "all", label: "All grades" },
  { value: "G11", label: "Grade 11" },
  { value: "G12", label: "Grade 12" },
];

export default function RegistrarSf10Page() {
  const [loading, setLoading] = React.useState(true);
  const [records, setRecords] = React.useState<Sf10Record[]>([]);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Sf10Status | "all">("all");
  const [grade, setGrade] = React.useState<"G11" | "G12" | "all">("all");
  const [selected, setSelected] = React.useState<Sf10Record | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback((signal?: AbortSignal) => {
    return fetchSf10Records(signal)
      .then((data) => setRecords(data))
      .catch((err: unknown) => {
        // Ignore aborts (component unmount / strict-mode remount) — not real errors.
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        const st = (err as { response?: { status?: number } })?.response?.status;
        setError(st ? `Failed to load SF10 records (HTTP ${st})` : "Failed to load SF10 records");
        console.error("[/api/sf10/records] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (grade !== "all" && r.gradeLevel !== grade) return false;
      if (q && !`${r.fullName} ${r.lrn}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, query, status, grade]);

  const counts = React.useMemo(
    () => ({
      attach: records.filter((r) => r.status === "attach").length,
      available: records.filter((r) => r.status === "available").length,
      released: records.filter((r) => r.status === "released").length,
    }),
    [records],
  );

  const handleSelect = (record: Sf10Record) => {
    setSelected(record);
    setSheetOpen(true);
  };

  const handleUpload = async (studentId: string, file: File) => {
    setUploading(true);
    try {
      await uploadSf10(studentId, file);
      await load();
    } catch (err) {
      console.error("[/api/sf10/upload] failed:", err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div className="flex items-center gap-2">
            <h1 className={styles.title}>SF10 Records</h1>
            <span className={styles.bandBadge}>Grades 11–12</span>
          </div>
          <p className={styles.subtitle}>
            Upload, validate, and store SF10 learner records. This is the registrar&apos;s
            repository for senior high (Grades 11–12) permanent records.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          placeholder="Search by name or LRN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={grade} onValueChange={(v) => setGrade(v as typeof grade)}>
          <SelectTrigger className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADE_FILTERS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={styles.muted}>
          {counts.attach} attached · {counts.available} available · {counts.released} released
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.stack}>
        <Sf10UploadPanel onUpload={handleUpload} uploading={uploading} />

        {loading ? (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Repository</h2>
              <span className={styles.muted}>{filtered.length} records</span>
            </div>
            <div className={styles.folderGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={styles.skeletonFolder} />
              ))}
            </div>
          </div>
        ) : (
          <Sf10Repository records={filtered} onSelect={handleSelect} />
        )}
      </div>

      <Sf10DetailSheet
        record={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={load}
      />
    </section>
  );
}
