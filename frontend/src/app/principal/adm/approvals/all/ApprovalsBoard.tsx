"use client";

import * as React from "react";
import {
  MOCK_ADM_CASES,
  ADM_DOCUMENTS,
  stageLabel,
} from "../../mockData";
import { AdmBrowser } from "../../AdmBoard";
import { DOC_LEGEND } from "../../components/DocumentCard";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import styles from "./approvals.module.css";
import legend from "../../components/admLegend.module.css";

const LEGEND_LABEL: Record<string, string> = Object.fromEntries(
  DOC_LEGEND.map((item) => [item.color.toLowerCase(), item.label])
);

function useApprovalsBoard() {
  const approved = React.useMemo(
    () =>
      [...MOCK_ADM_CASES]
        .filter((c) => c.approvedBy !== null)
        .sort((a, b) => (a.approvalDate ?? "").localeCompare(b.approvalDate ?? "")),
    []
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(
    approved.length ? approved[0].id : null
  );

  const selected = approved.find((c) => c.id === selectedId) ?? approved[0] ?? null;

  return { approved, selected, selectedId, setSelectedId };
}

function FileIcon({ icon }: { icon: "image" | "video" | "code" | "pdf" | "ppt" }) {
  if (icon === "image")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  if (icon === "video")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  if (icon === "code")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  if (icon === "ppt")
    return (
      <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  return (
    <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function ApprovalsBoard() {
  const { approved, selected, selectedId, setSelectedId } = useApprovalsBoard();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? approved.filter(
          (c) =>
            c.student.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            (c.approvedBy ?? "").toLowerCase().includes(q)
        )
      : approved;
    return [...list].sort((a, b) =>
      (b.approvalDate ?? "").localeCompare(a.approvalDate ?? "")
    );
  }, [approved, query]);

  const handleBlob = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <section className={styles.layout}>
      <div className={styles.browserWrap}>
        <div className={styles.leftPanel}>
          <AdmBrowser
            tabs={[{ id: "all", label: "All Approved" }]}
            activeTab="all"
            onTabChange={() => {}}
          >
            <Command className={styles.command}>
              <CommandInput
                placeholder="Search by name, ID, or approver…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList className={styles.list}>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.student} ${c.id} ${c.approvedBy ?? ""}`}
                    className={`${styles.listItem} ${c.id === selectedId ? styles.listItemActive : ""}`}
                    onSelect={() => setSelectedId(c.id)}
                  >
                    <span className={styles.listAvatar}>
                      {c.student
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className={styles.listMain}>
                      <span className={styles.listName}>{c.student}</span>
                      <span className={styles.listMeta}>
                        {c.id} · {c.approvedBy} · {c.approvalDate}
                      </span>
                    </span>
                  </CommandItem>
                ))}
                <CommandEmpty className={styles.empty}>No matching profiles.</CommandEmpty>
              </CommandList>
            </Command>
          </AdmBrowser>
        </div>
      </div>

      <div className={styles.rightPanel}>
        {selected ? (
          <>
            <div className={styles.docHead}>
              <div>
                <h2 className={styles.docTitle}>{selected.student}</h2>
                <p className={styles.docSub}>
                  {selected.grade} · {selected.section} · Approved by {selected.approvedBy} on{" "}
                  {selected.approvalDate}
                </p>
              </div>
              <Badge variant="secondary">{ADM_DOCUMENTS.length} docs</Badge>
            </div>

            <div className={styles.folderRow}>
              {ADM_DOCUMENTS.map((doc) => (
                <div key={doc.name} className={styles.folderCard}>
                  <div className={styles.folderContainer}>
                    <svg className={styles.folderBack} viewBox="0 0 50 40" fill="none">
                      <path
                        d="M0 4C0 1.79086 1.79086 0 4 0H16.524C17.721 0 18.8415 0.54051 19.574 1.4673L22.426 5.0654C23.1585 5.99219 24.279 6.5327 25.476 6.5327H46C48.2091 6.5327 50 8.32356 50 10.5327V36C50 38.2091 48.2091 40 46 40H4C1.79086 40 0 38.2091 0 36V4Z"
                        fill={doc.color}
                      />
                    </svg>

                    <div className={`${styles.file} ${styles.fileOnly}`}>
                      <div className={styles.shine} />
                      <FileIcon icon={doc.icon} />
                      <div className={styles.fileText}>{doc.name}</div>
                      <div className={styles.fileCaption}>
                        {LEGEND_LABEL[doc.color.toLowerCase()] ?? doc.type}
                      </div>
                      <div className={styles.fileTag}>
                        {doc.type} • {doc.size}
                      </div>
                    </div>

                    <div className={styles.folderFrontWrapper}>
                      <svg className={styles.folderFront} viewBox="0 0 50 34" fill="none">
                        <path
                          d="M0 4C0 1.79086 1.79086 0 4 0H46C48.2091 0 50 1.79086 50 4V30C50 32.2091 48.2091 34 46 34H4C1.79086 34 0 32.2091 0 30V4Z"
                          fill="rgba(0, 123, 255, 0.65)"
                        />
                      </svg>
                      <div className={styles.folderLabel} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={legend.docLegend}>
              {DOC_LEGEND.map((item) => (
                <span key={item.label} className={legend.docLegendItem}>
                  <span
                    className={legend.docLegendSwatch}
                    style={{ background: item.color }}
                  />
                  <span className={legend.docLegendLabel}>{item.label}</span>
                </span>
              ))}
            </div>

            <div className={styles.progressSection}>
              <span className={styles.sectionLabel}>ADM Progress</span>

              <Badge variant={selected.stage === "completion" ? "default" : "secondary"}>
                {stageLabel(selected.stage)}
              </Badge>

              <div className={styles.progressStats}>
                <div className={styles.statCard} onMouseMove={handleBlob}>
                  <span className={styles.statLabel}>Grade &amp; Section</span>
                  <span className={styles.statValue}>
                    {selected.grade} · {selected.section}
                  </span>
                </div>
                <div className={styles.statCard} onMouseMove={handleBlob}>
                  <span className={styles.statLabel}>Eligibility</span>
                  <span
                    className={`${styles.statValue} ${
                      selected.eligibilityStatus === "eligible"
                        ? styles.statValueYes
                        : styles.statValueNo
                    }`}
                  >
                    {selected.eligibilityStatus}
                  </span>
                </div>
                <div className={styles.statCard} onMouseMove={handleBlob}>
                  <span className={styles.statLabel}>Parent Meeting</span>
                  <span
                    className={`${styles.statValue} ${
                      selected.meetingAttended ? styles.statValueYes : styles.statValueNo
                    }`}
                  >
                    {selected.meetingAttended ? "Attended" : "Not attended"}
                  </span>
                </div>
                <div className={styles.statCard} onMouseMove={handleBlob}>
                  <span className={styles.statLabel}>Device Issued</span>
                  <span
                    className={`${styles.statValue} ${
                      selected.deviceIssued ? styles.statValueYes : styles.statValueNo
                    }`}
                  >
                    {selected.deviceIssued ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div className={styles.moduleBar}>
                <div className={styles.progressStats} style={{ gap: "0.375rem" }}>
                  <span className={styles.statLabel}>Modules</span>
                  <span className={styles.statValue}>
                    {selected.modulesSubmitted} / {selected.modulesTotal}
                  </span>
                </div>
                <div className={styles.moduleBarTrack}>
                  <div
                    className={styles.moduleBarFill}
                    style={{
                      width: `${Math.round(
                        (selected.modulesSubmitted / selected.modulesTotal) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.empty}>No approved profile selected.</p>
        )}
      </div>
    </section>
  );
}

export default function PrincipalAdmApprovalsPage() {
  return <ApprovalsBoard />;
}
