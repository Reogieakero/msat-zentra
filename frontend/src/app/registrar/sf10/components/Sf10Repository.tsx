"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import { StatusBadge } from "./shared";
import { FolderCard, type FolderFile } from "@/components/ui/folder-card";
import { BrowserCard } from "@/components/ui/browser-card";
import { GRADE_LABEL, SF10_SOURCE_LABEL, type Sf10Record } from "../types";
import styles from "../sf10.module.css";

const STATUS_FOLDER_COLOR: Record<Sf10Record["status"], string> = {
  attach: "rgba(217, 119, 6, 0.7)",
  available: "rgba(0, 123, 255, 0.65)",
  released: "rgba(22, 163, 74, 0.65)",
};

function toFolderFiles(record: Sf10Record): FolderFile[] {
  return [
    {
      name: `${record.fullName.replace(/\s+/g, "_")}_SF10.pdf`,
      type: "PDF",
      size: "1.4 MB",
      color: "#4facfe",
      icon: "pdf",
    },
  ];
}

export function Sf10Repository({
  records,
  onSelect,
}: {
  records: Sf10Record[];
  onSelect: (record: Sf10Record) => void;
}) {
  // Group by grade + section (e.g. "G11 · Agila") and build one tab per group.
  const groups = React.useMemo(() => {
    const map = new Map<string, { grade: Sf10Record["gradeLevel"]; section: string; list: Sf10Record[] }>();
    for (const r of records) {
      const key = `${r.gradeLevel}__${r.section}`;
      const entry = map.get(key) ?? { grade: r.gradeLevel, section: r.section, list: [] };
      entry.list.push(r);
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, v]) => ({
        id: key,
        grade: v.grade,
        section: v.section,
        label: `${GRADE_LABEL[v.grade]} · ${v.section}`,
        list: [...v.list].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }))
      .sort((a, b) => (a.grade === b.grade ? a.section.localeCompare(b.section) : a.grade.localeCompare(b.grade)));
  }, [records]);

  const [active, setActive] = React.useState<string>(groups[0]?.id ?? "");

  // Derive the effective active group: fall back to the first group when the
  // selected id is no longer present (filters changed the available groups).
  const activeId = groups.some((g) => g.id === active) ? active : groups[0]?.id ?? "";

  const current = groups.find((g) => g.id === activeId) ?? groups[0];
  const visible = current?.list ?? [];

  if (records.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FolderOpen className={styles.emptyIcon} />
        <p>No SF10 records match the current filters.</p>
      </div>
    );
  }

  return (
    <BrowserCard
      tabs={groups.map((g) => ({ id: g.id, label: g.label, count: g.list.length }))}
      activeTab={activeId}
      onTabChange={setActive}
    >
      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderOpen className={styles.emptyIcon} />
          <p>No SF10 records in {current?.label}.</p>
        </div>
      ) : (
        <div className={styles.folderGrid}>
          {visible.map((r) => (
            <div key={r.id} className={styles.folderItem}>
              <FolderCard
                files={toFolderFiles(r)}
                folderColor={STATUS_FOLDER_COLOR[r.status]}
                label={`${r.fullName} SF10`}
                onOpen={() => onSelect(r)}
              />
              <div className={styles.folderMeta}>
                <div className={styles.folderMetaTop}>
                  <span className={styles.folderStudent}>{r.fullName}</span>
                  <StatusBadge status={r.status} />
                </div>
                <span className={styles.lrn}>{r.lrn}</span>
                <span className={styles.muted}>{SF10_SOURCE_LABEL[r.source]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </BrowserCard>
  );
}
