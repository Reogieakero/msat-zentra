"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import {
  entryStatusLabel,
  HEALTH_FOLDER_COLORS,
  type StudentHealthFolder,
} from "./documentaries-utils";
import styles from "./StudentHealthFolders.module.css";

const TYPE_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  ADM: 3,
  Clinic: 2,
};

function folderFiles(folder: StudentHealthFolder): FolderFile[] {
  return folder.entries.slice(0, 5).map((e) => ({
    name: e.session ? `Session_${e.dateDay}` : `Case_${e.dateDay}`,
    tag:
      e.files.length > 0
        ? `${e.files.length} file${e.files.length === 1 ? "" : "s"} · ${entryStatusLabel(e)}`
        : entryStatusLabel(e),
    tone: TYPE_TONES[e.row.type] ?? 1,
    icon: e.files.length > 0 ? "image" : "doc",
  }));
}

export function StudentHealthFolders({
  folders,
  onOpenCase,
}: {
  folders: StudentHealthFolder[];
  onOpenCase: (folder: StudentHealthFolder, index: number) => void;
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return folders;
    return folders.filter((f) =>
      `${f.student} ${f.lrn} ${f.section}`.toLowerCase().includes(needle),
    );
  }, [folders, needle]);

  const caseCount = folders.reduce((sum, f) => sum + f.entries.length, 0);
  const fileCount = folders.reduce((sum, f) => sum + f.fileCount, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Health Records</h2>
          <p className={styles.sectionDesc}>
            One folder per student — {folders.length} folder{folders.length === 1 ? "" : "s"},{" "}
            {caseCount} case{caseCount === 1 ? "" : "s"}, {fileCount} file{fileCount === 1 ? "" : "s"}.
            Open a folder to read its cases.
          </p>
        </div>
        {folders.length > 0 && (
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder="Search student, LRN, section…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search student folders"
            />
          </div>
        )}
      </div>

      {folders.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No files stored yet</p>
          <p className={styles.emptyBody}>
            Finished clinic sessions and resolved cases will appear here, one
            folder per student.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className={styles.emptyInline}>No student folders match your search.</p>
      ) : (
        <ul className={styles.folderGrid} aria-label="Student health folders">
          {visible.map((folder) => (
            <li key={folder.key} className={styles.folderCell}>
              <button
                type="button"
                className={styles.folderBtn}
                onClick={() => onOpenCase(folder, 0)}
                aria-label={`Open ${folder.student}'s health folder (${folder.entries.length} cases, ${folder.fileCount} files)`}
              >
                <FolderCard
                  label={folder.student}
                  sublabel={
                    [folder.lrn, folder.section].filter((v) => v && v !== "—").join(" · ") || undefined
                  }
                  folderColor={HEALTH_FOLDER_COLORS[folder.dominantType]}
                  cornerTag={folder.dominantType}
                  files={folderFiles(folder)}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
