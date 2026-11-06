"use client";

import * as React from "react";
import { Database, Info, Trophy } from "lucide-react";
import {
  folderStorageBytes,
  formatBytes,
  HEALTH_FOLDER_COLORS,
  type StudentHealthFolder,
} from "./documentaries-utils";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

function share(total: number, part: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

function StorageCard({ folders }: { folders: StudentHealthFolder[] }) {
  const total = folderStorageBytes(folders);
  const fileCount = folders.reduce((sum, f) => sum + f.fileCount, 0);
  const top = folders
    .filter((f) => f.storageBytes > 0)
    .toSorted((a, b) => b.storageBytes - a.storageBytes)
    .slice(0, 3);
  return (
    <div className={assign.card} aria-label="Documentation storage">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Database size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Storage</h3>
          <p className="text-xs text-muted-foreground">
            {formatBytes(total) || "0 B"} · {fileCount} file{fileCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">
          No documentation filed yet.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-2">
          {top.map((f) => (
            <li key={f.key} className="min-w-0 text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span className="block truncate font-medium text-primary">{f.student}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(f.storageBytes)} · {share(total, f.storageBytes)}%
                </span>
              </span>
              <span
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${share(total, f.storageBytes)}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TopStudentsCard({ folders }: { folders: StudentHealthFolder[] }) {
  const top = React.useMemo(
    () =>
      [...folders]
        .sort((a, b) => b.entries.length - a.entries.length)
        .slice(0, 5),
    [folders],
  );
  return (
    <div className={assign.card} aria-label="Top students by records">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Trophy size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Top 5 students</h3>
          <p className="text-xs text-muted-foreground">Most finished cases on file.</p>
        </div>
      </div>
      {top.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">No records yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-2">
          {top.map((f, i) => (
            <li key={f.key} className="flex items-center gap-2 text-sm">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-primary">{f.student}</span>
              </span>
              <span
                className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums"
                aria-label={`${f.entries.length} cases`}
              >
                {f.entries.length}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FolderLegendCard() {
  return (
    <div className={assign.card} aria-label="Folder color legend">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Info size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Legend</h3>
          <p className="text-xs text-muted-foreground">What each folder color means.</p>
        </div>
      </div>
      <div className="relative flex flex-col gap-1.5 text-sm">
        {(Object.keys(HEALTH_FOLDER_COLORS) as ("ADM" | "Clinic")[]).map((key) => (
          <span key={key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: HEALTH_FOLDER_COLORS[key] }}
              aria-hidden="true"
            />
            {key === "ADM" ? "ADM — mostly ADM consultations" : "Clinic — mostly clinic sessions"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HealthRecordsSideRail({ folders }: { folders: StudentHealthFolder[] }) {
  return (
    <>
      <StorageCard folders={folders} />
      <TopStudentsCard folders={folders} />
      <FolderLegendCard />
    </>
  );
}
