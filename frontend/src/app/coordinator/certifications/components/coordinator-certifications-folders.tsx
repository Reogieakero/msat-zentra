"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderCard } from "@/components/ui/FolderCard";
import { Button } from "@/components/ui/button";
import { Award, HelpCircle, Loader2 } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill, type PillTone } from "@/components/ui/pill";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useDock } from "@/components/dock/dock-store";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import { useNowTick } from "@/lib/clock";
import { toSlug } from "@/lib/slug";
import { CERT_STATUS_META } from "@/services/coordinator/certifications.service";
import type {
  CertRecord,
  CertStatus,
  CertStatusFilter,
} from "@/services/coordinator/certifications.types";
import { CoordinatorCertificationsFilters } from "./coordinator-certifications-filters";
import { CoordinatorCertificationsEndorseConfirm } from "./coordinator-certifications-endorse-confirm";
import { CoordinatorEmptyCard } from "../../components/CoordinatorEmptyCard";
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

/** Centered status tabs — same pattern as the referrals desk. */
const STATUS_TABS: { value: CertStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "prepared", label: "Prepared" },
  { value: "awaiting", label: "Awaiting" },
  { value: "revision", label: "Needs revision" },
  { value: "approved", label: "Approved" },
];

const STATUS_TONE: Record<CertStatus, PillTone> = {
  prepared: "amber",
  awaiting: "blue",
  revision: "red",
  approved: "green",
};

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

  const counts = React.useMemo<Record<CertStatusFilter, number>>(() => {
    const out: Record<CertStatusFilter, number> = {
      all: records.length,
      prepared: 0,
      awaiting: 0,
      revision: 0,
      approved: 0,
    };
    for (const record of records) out[record.status] += 1;
    return out;
  }, [records]);

  // Filter the loaded rows instantly as the clerk types (same feel as the
  // referrals desk); the debounced server query then swaps in matches from the
  // rest of the desk.
  const searchTerm = query.trim().toLowerCase();
  const searched = React.useMemo(() => {
    if (searchTerm === "") return records;
    return records.filter((record) =>
      `${record.student} ${record.lrn} ${record.grade}`
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [records, searchTerm]);

  const filtered = React.useMemo(
    () =>
      status === "all"
        ? searched
        : searched.filter((r) => r.status === status),
    [searched, status],
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
      `/coordinator/referrals/${encodeURIComponent(toSlug(record.student))}`,
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
      <KanbanBoard
        title="Certification files"
        icon={
          <span className="text-amber-500" aria-hidden>
            <Award size={14} />
          </span>
        }
        description={
          <>
            One folder per certification you issued — {total} record
            {total === 1 ? "" : "s"}
            {isSyncing ? " · Syncing…" : ""}.
          </>
        }
        ariaLabel="Certification files"
        headerCenter={
          <div
            className={styles.filterRow}
            role="tablist"
            aria-label="Filter certifications by status"
          >
            {STATUS_TABS.map((tab) => {
              const active = status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={styles.filterButton}
                  onClick={() => {
                    setPage(1);
                    onStatusChange(tab.value);
                  }}
                >
                  <Pill
                    tone={active ? "blue" : "neutral"}
                    label={`${tab.label} certifications`}
                  >
                    {tab.label}
                    <span className={styles.statusTabCount}>
                      {counts[tab.value]}
                    </span>
                  </Pill>
                </button>
              );
            })}
          </div>
        }
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.helpBtn}
              onClick={() => setHelpOpen(true)}
              aria-label="What do the certification status labels mean?"
              title="What do the certification status labels mean?"
            >
              <HelpCircle aria-hidden="true" />
            </button>
            <CoordinatorCertificationsFilters
              query={query}
              onQueryChange={(v) => {
                setPage(1);
                onQueryChange(v);
              }}
            />
          </div>
        }
        footer={
          visible.length > 0 ? (
            <Pagination
              currentPage={safePage}
              totalItems={total}
              onPageChange={setPage}
            />
          ) : null
        }
      >
        {visible.length === 0 ? (
          <div className={styles.emptyCallout}>
            <InsightCallout role="status">
              {searchTerm !== "" || status !== "all"
                ? "No certification files match your search or filters. Try a different name, LRN, or status."
                : "No certification files to show."}
            </InsightCallout>
          </div>
        ) : (
          <div className={styles.studentGrid}>
            {visible.map(({ record, date }, index) => {
              const meta = CERT_STATUS_META[record.status];
              return (
                <article
                  key={record.id}
                  className={styles.certCard}
                  style={{ animationDelay: `${Math.min(index, 11) * 60}ms` }}
                >
                  <div className={styles.certCardHead}>
                    <Pill
                      tone={STATUS_TONE[record.status]}
                      label="Certification status"
                    >
                      <Award size={13} aria-hidden />
                      {meta.label}
                    </Pill>
                    <span className={styles.certCardAge}>{timeAgo(date)}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.certCardBody}
                    onClick={() => openRecord(record)}
                    aria-label={`Open ${record.student}'s certification file`}
                  >
                    <span className={styles.certPills}>
                      <Pill tone="amber" label="Learner">
                        {record.student}
                      </Pill>
                      <Pill tone="neutral" label="LRN">
                        {record.lrn}
                      </Pill>
                      <Pill tone="neutral" label="Grade level">
                        {record.grade}
                      </Pill>
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
                        <Pill tone="green" label="Signature">
                          Signed
                        </Pill>
                        {record.approvedBy ? (
                          <Pill tone="neutral" label="Signed by">
                            {record.approvedBy}
                          </Pill>
                        ) : null}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </KanbanBoard>

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
