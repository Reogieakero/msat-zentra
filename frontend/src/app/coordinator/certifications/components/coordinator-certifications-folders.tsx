"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderCard } from "@/components/ui/FolderCard";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "../../components/coordinator-data";
import {
  CERT_STATUS_META,
  type CertRecord,
  type CertStatusFilter,
} from "./coordinator-certifications-data";
import { CoordinatorCertificationsFilters } from "./coordinator-certifications-filters";
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
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  status: CertStatusFilter;
  onStatusChange: (value: CertStatusFilter) => void;
  isNavigating?: boolean;
}

/**
 * Certification files — one folder per certification the ADM Coordinator
 * issued. Opening a folder opens the full case file in a new tab; prepared
 * cases can be endorsed to the Principal straight from the grid.
 */
export function CoordinatorCertificationsFolders({
  records,
  page,
  pageSize,
  onPageChange,
  query,
  onQueryChange,
  status,
  onStatusChange,
  isNavigating = false,
}: CoordinatorCertificationsFoldersProps) {
  const queryClient = useQueryClient();
  const [forwardTarget, setForwardTarget] =
    React.useState<CertRecord | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  /** Row being endorsed — its folder shows `Endorsing…` while every
      other folder stays usable. */
  const [forwardingId, setForwardingId] = React.useState<string | null>(null);

  const forwardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: (_data, id) => {
      // The endorsed folder locks immediately — patch the cached stage
      // rows instead of waiting for the refetch.
      queryClient.setQueriesData<unknown>(
        { queryKey: ["coordinator-certifications"] },
        (cached: unknown) => {
          if (!Array.isArray(cached)) return cached;
          let changed = false;
          const next = (cached as { id?: string; stage?: string }[]).map(
            (r) => {
              if (r?.id !== id) return r;
              changed = true;
              return { ...r, stage: "principal_approval" };
            },
          );
          return changed ? (next as unknown) : cached;
        },
      );
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-certifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-dashboard"],
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

  const filtered =
    status === "all" ? records : records.filter((r) => r.status === status);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openRecord = (record: CertRecord) => {
    window.open(
      `/coordinator/referrals/${encodeURIComponent(record.id)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <Card className={styles.panel}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <CardTitle className={styles.sectionTitle}>
                Certification files
              </CardTitle>
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
            <CardDescription className={styles.sectionDesc}>
              One folder per certification you issued — {total} record
              {total === 1 ? "" : "s"}.
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
            <CoordinatorCertificationsFilters
              query={query}
              onQueryChange={onQueryChange}
              status={status}
              onStatusChange={onStatusChange}
            />
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {visible.length === 0 ? (
            <p className={styles.empty}>
              No certification files match the current filters.
            </p>
          ) : (
            <div className={styles.studentGrid}>
              {visible.map((record) => {
                const meta = CERT_STATUS_META[record.status];
                const date = record.datePrepared ?? record.approvalDate;
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
          {total > 0 ? (
            <div className={styles.pager}>
              <p className={styles.range}>
                Showing {start}–{end} of {total}
              </p>
              <div className={styles.pagerButtons}>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={safePage <= 1 || isNavigating}
                  onClick={() => onPageChange(safePage - 1)}
                >
                  Previous
                </Button>
                <span className={styles.pageLabel} aria-live="polite">
                  {isNavigating ? (
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
                      Loading…
                    </span>
                  ) : (
                    `Page ${safePage} of ${totalPages}`
                  )}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={safePage >= totalPages || isNavigating}
                  onClick={() => onPageChange(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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

      <Dialog open={helpOpen} onOpenChange={(open) => !open && setHelpOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What do the folder badges mean?</DialogTitle>
            <DialogDescription>
              Every folder is a certification you issued. The badge is its
              current status — click any folder to open the full case file.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
