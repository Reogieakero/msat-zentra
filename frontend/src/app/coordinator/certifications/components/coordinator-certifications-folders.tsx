"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderCard } from "@/components/ui/FolderCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Award, HelpCircle, Loader2, SearchX } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
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
import { CoordinatorEmptyCard, CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
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

const DISPLAY_LIMIT = 15;

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

  const forwardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (_data, id) => {

      markSelfNotified(id);
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-certifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-dashboard"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-notifications"],
      });
      setForwardTarget(null);
      toast.success({
        title: "Endorsed to Principal",
        description:
          "The case is now locked awaiting the Principal's signature.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not forward",
        description: apiErrorMessage(err),
      }),
    onSettled: () => setForwardingId(null),
  });

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
                aria-label="What do the folder badges mean?"
                title="What do the folder badges mean?"
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
                  <div key={record.id} className={styles.studentBlock}>
                    <button
                      type="button"
                      className={styles.studentFolderBtn}
                      onClick={() => openRecord(record)}
                      aria-label={`Open ${record.student}'s certification file`}
                    >
                      <span className={styles.folderWrap}>
                        <span className={styles.folderBadge} aria-hidden="true">
                          <span
                            className={styles.statusText}
                            style={{ color: meta.color }}
                            title={meta.label}
                          >
                            {meta.label}
                          </span>
                        </span>
                        <FolderCard
                          label={record.student}
                          sublabel={`${record.lrn} · ${record.grade}`}

                          folderColor="var(--primary)"
                          files={[
                            {
                              name: `CERT_${(date ?? "").slice(0, 10) || record.id.slice(0, 8)}`,
                              tag: `${record.formsCount} evidence file${record.formsCount === 1 ? "" : "s"} • ${timeAgo(date)}`,
                              icon: "doc" as const,
                            },
                          ]}
                        />
                      </span>
                    </button>
                    <div className={styles.folderActions}>
                      {record.status === "prepared" ? (
                        <Button
                          size="xs"
                          variant="outline"
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
                        <p className={styles.lockedNote}>
                          Signed{record.approvedBy ? ` · ${record.approvedBy}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalPages > 1 ? (
            <div className={styles.pager} aria-label="Certification pagination">
              <p className={styles.pagerCount}>
                Showing {start}–{end} of {total} · Page {safePage} of{" "}
                {totalPages}
              </p>
              <div className={styles.pagerActions}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={forwardTarget !== null}
        onOpenChange={(open) => !open && setForwardTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endorse to Principal?</AlertDialogTitle>
            <AlertDialogDescription>
              {forwardTarget ? (
                <>
                  {forwardTarget.student}&apos;s certification will be locked
                  and sent to the Principal for final signature.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={forwardMutation.isPending}
              onClick={() => {
                if (forwardTarget && !forwardMutation.isPending) {
                  setForwardingId(forwardTarget.id);
                  forwardMutation.mutate(forwardTarget.id);
                }
              }}
            >
              {forwardMutation.isPending ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              {forwardMutation.isPending ? "Endorsing…" : "Endorse"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CardModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        size="sm"
        title="What do the folder badges mean?"
        description="Every folder is a certification you issued. The badge is its current status — click any folder to open the full case file."
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
          <div className={styles.helpActions}>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Understood
            </Button>
          </div>
      </CardModal>
    </>
  );
}
