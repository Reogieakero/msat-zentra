"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderCard } from "@/components/ui/FolderCard";
import { Button } from "@/components/ui/button";
import { Award, HelpCircle, Loader2, SearchX } from "lucide-react";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useDock } from "@/components/dock/dock-store";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { useNowTick } from "@/lib/clock";
import { CERT_STATUS_META } from "@/services/coordinator/certifications.service";
import type {
  CertRecord,
  CertStatusFilter,
} from "@/services/coordinator/certifications.types";
import { CoordinatorCertificationsFilters } from "./coordinator-certifications-filters";
import { CoordinatorCertificationsEndorseConfirm } from "./coordinator-certifications-endorse-confirm";
import { CoordinatorEmptyCard, CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import styles from "./coordinator-certifications-folders.module.css";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const date = iso.slice(0, 10);
  const then = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface CoordinatorCertificationsFoldersProps {
  records: CertRecord[];
  query: string;
  onQueryChange: (value: string) => void;
  status: CertStatusFilter;
  onStatusChange: (value: CertStatusFilter) => void;

  isSyncing?: boolean;
}

const DISPLAY_LIMIT = PAGE_SIZE;

/** Amber folder body — matches the coordinator desk accent. */
const CERT_FOLDER_COLOR = "#f59e0b";

export function CoordinatorCertificationsFolders({
  records,
  query,
  onQueryChange,
  status,
  onStatusChange,
  isSyncing = false,
}: CoordinatorCertificationsFoldersProps) {
  const queryClient = useQueryClient();
  const [forwardTarget, setForwardTarget] =
    React.useState<CertRecord | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  const [forwardingId, setForwardingId] = React.useState<string | null>(null);
  const dock = useDock();

  const forwardMutation = useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      student: string;
      taskId: string | null;
    }) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      markSelfNotified(vars.id);
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-certifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-dashboard"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-notifications"],
      });
      if (vars.taskId) {
        dock.completeTask(vars.taskId, `${vars.student} → Principal`);
      }
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not forward",
        description: apiErrorMessage(err),
      });
    },
    onSettled: () => setForwardingId(null),
  });

  /** Confirming closes the overlay at once — the shared Dock reports it. */
  const confirmForward = () => {
    const record = forwardTarget;
    if (!record || forwardMutation.isPending) return;
    setForwardTarget(null);
    setForwardingId(record.id);
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "adm-endorse",
        title: "Endorsing to Principal",
        description: `${record.student} → Principal`,
      });
    } catch {
      taskId = null;
    }
    forwardMutation.mutate({
      id: record.id,
      student: record.student,
      taskId,
    });
  };

  const filtered = React.useMemo(
    () => (status === "all" ? records : records.filter((r) => r.status === status)),
    [records, status],
  );
  const total = filtered.length;

  const totalPages = Math.max(1, Math.ceil(total / DISPLAY_LIMIT));
  const [page, setPage] = React.useState(1);

  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * DISPLAY_LIMIT + 1;
  const end = Math.min(safePage * DISPLAY_LIMIT, total);

  const nowTick = useNowTick();
  const visible = React.useMemo(
    () =>
      filtered.slice(start - 1, end).map((record) => ({
        record,
        date: record.datePrepared ?? record.approvalDate,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, start, end, nowTick],
  );

  const openRecord = (record: CertRecord) => {
    window.open(
      `/coordinator/referrals/${encodeURIComponent(record.id)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (records.length === 0 && query.trim() === "" && status === "all") {
    return (
      <CoordinatorEmptyCard
        icon={Award}
        title="No certifications on file yet"
        hint="Certifications you prepare will appear here as folders you can endorse."
        label="Certifications"
        centered
      />
    );
  }

  return (
    <>

      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h3 className={styles.sectionTitle}>
                Certification files
              </h3>
              <button
                type="button"
                className={styles.helpBtn}
                onClick={() => setHelpOpen(true)}
                aria-label="What do the certification status labels mean?"
                title="What do the certification status labels mean?"
              >
                <HelpCircle aria-hidden="true" />
              </button>
            </div>
            <p className={styles.sectionDesc}>
              One folder per certification you issued — {total} record
              {total === 1 ? "" : "s"}
              {isSyncing ? " · Syncing…" : ""}.
            </p>
          </div>
          <div className={styles.headerActions}>
            <CoordinatorCertificationsFilters
              query={query}
              onQueryChange={(v) => {
                setPage(1);
                onQueryChange(v);
              }}
              status={status}
              onStatusChange={(v) => {
                setPage(1);
                onStatusChange(v);
              }}
            />
          </div>
        </div>
        <div className={styles.content}>
          {visible.length === 0 ? (
            <CoordinatorEmptyState
              icon={SearchX}
              title="No matching certifications"
              hint="No certification files match the current filters."
            />
          ) : (
            <div className={styles.studentGrid}>
              {visible.map(({ record, date }) => {
                const meta = CERT_STATUS_META[record.status];
                return (
                  <article key={record.id} className={styles.certCard}>
                    <div className={styles.certCardHead}>
                      <span
                        className={styles.certStatusPill}
                        title={meta.label}
                        style={{
                          color: `color-mix(in srgb, ${meta.color} 70%, var(--foreground))`,
                          borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
                        }}
                      >
                        <Award size={13} aria-hidden />
                        {meta.label}
                      </span>
                      <span className={styles.certCardAge}>{timeAgo(date)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.certCardBody}
                      onClick={() => openRecord(record)}
                      aria-label={`Open ${record.student}'s certification file`}
                    >
                      <span className={styles.certPills}>
                        <span
                          className={`${styles.certPill} ${styles.certStudentPill}`}
                          title={record.student}
                        >
                          {record.student}
                        </span>
                        <span
                          className={`${styles.certPill} ${styles.certMetaPill}`}
                          title={`LRN ${record.lrn}`}
                        >
                          {record.lrn}
                        </span>
                        <span
                          className={`${styles.certPill} ${styles.certMetaPill}`}
                          title={`Grade ${record.grade}`}
                        >
                          {record.grade}
                        </span>
                      </span>
                      <span className={styles.certFolderRow}>
                        <span className={styles.certFolderWrap}>
                          <FolderCard
                            label=""
                            folderColor={CERT_FOLDER_COLOR}
                            files={[
                              {
                                name: `CERT_${(date ?? "").slice(0, 10) || record.id.slice(0, 8)}`,
                                tag: `${record.formsCount} evidence file${record.formsCount === 1 ? "" : "s"} • ${timeAgo(date)}`,
                                tone: 1 as const,
                                icon: "doc" as const,
                              },
                            ]}
                          />
                        </span>
                        <span className={styles.certMascot} aria-hidden="true">
                          <StudentMascot
                            name={record.student}
                            seed={record.lrn}
                            size={52}
                          />
                        </span>
                      </span>
                    </button>
                    <div className={styles.folderActions}>
                      {record.status === "prepared" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={forwardingId === record.id}
                          onClick={() => setForwardTarget(record)}
                        >
                          {forwardingId === record.id ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.375rem",
                              }}
                            >
                              <Loader2
                                className="animate-spin"
                                aria-hidden
                                style={{ width: "0.875rem", height: "0.875rem" }}
                              />
                              Endorsing…
                            </span>
                          ) : (
                            "Endorse"
                          )}
                        </Button>
                      ) : record.status === "awaiting" ? (
                        <p className={styles.lockedNote}>
                          Locked · awaiting signature
                        </p>
                      ) : record.status === "revision" ? (
                        <p className={styles.lockedNote}>
                          Revise evidence, then forward
                        </p>
                      ) : (
                        <span className={styles.signedRow}>
                          <span className={styles.signedPill}>Signed</span>
                          {record.approvedBy ? (
                            <span
                              className={styles.approverPill}
                              title={`Signed by ${record.approvedBy}`}
                            >
                              {record.approvedBy}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <Pagination
            currentPage={safePage}
            totalItems={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {forwardTarget ? (
        <CoordinatorCertificationsEndorseConfirm
          record={forwardTarget}
          onConfirm={confirmForward}
          onClose={() => setForwardTarget(null)}
        />
      ) : null}

      <KanbanOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        width="sm"
        title="What do the certification status labels mean?"
        icon={
          <span className="text-primary" aria-hidden>
            <HelpCircle size={14} />
          </span>
        }
        description="Every amber folder is a certification you issued. The label on top is its current status — click the folder to open the full case file."
        footer={
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button
              type="button"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => setHelpOpen(false)}
              autoFocus
            >
              Understood
            </Button>
          </div>
        }
      >
          <ul className={styles.helpList}>
            <li>
              <p className={styles.helpItemTitle}>Prepared — ready to endorse</p>
              <p className={styles.helpItemText}>
                The recommendation is recorded. Press Endorse under the folder
                to lock it and send it to the Principal for final signature.
              </p>
            </li>
            <li>
              <p className={styles.helpItemTitle}>
                Awaiting signature — with the Principal
              </p>
              <p className={styles.helpItemText}>
                The case is locked and waiting for the Principal&apos;s
                signature. Only the Principal can sign — you prepare and
                forward.
              </p>
            </li>
            <li>
              <p className={styles.helpItemTitle}>Needs revision — fix first</p>
              <p className={styles.helpItemText}>
                The evidence chain is incomplete or the Principal returned the
                case. Open the case file, revise the evidence, then forward.
              </p>
            </li>
            <li>
              <p className={styles.helpItemTitle}>Approved — signed</p>
              <p className={styles.helpItemText}>
                Signed by the Principal. Monitoring continues on the Enrolled
                Students page.
              </p>
            </li>
          </ul>
      </KanbanOverlay>
    </>
  );
}
