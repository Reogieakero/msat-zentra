"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttentionItem } from "./coordinator-overview-helpers";
import styles from "./coordinator-overview-attention-dialog.module.css";

interface CoordinatorOverviewAttentionDialogProps {
  open: boolean;
  onClose: () => void;
  attention: AttentionItem[];
  attentionError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

export function CoordinatorOverviewAttentionDialog({
  open,
  onClose,
  attention,
  attentionError,
  isRetrying,
  onRetry,
}: CoordinatorOverviewAttentionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent style={{ maxWidth: "32rem" }}>
        <DialogHeader>
          <DialogTitle>Needs attention</DialogTitle>
          <DialogDescription>
            Actionable items across your desk, newest workflow first.
          </DialogDescription>
        </DialogHeader>
        {attentionError ? (
          <div className={styles.inlineError} role="alert">
            <p className={styles.inlineErrorText}>
              Device counts couldn&apos;t load — other counts are current.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isRetrying}
              onClick={onRetry}
            >
              {isRetrying ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              {isRetrying ? "Loading…" : "Retry devices"}
            </Button>
          </div>
        ) : null}
        <ul className={styles.historyList} style={{ marginTop: 0 }}>
          {attention.map((a) => (
            <li key={a.label} className={styles.historyItem}>
              <span
                className={styles.historyDot}
                style={{
                  backgroundColor:
                    a.count === null
                      ? "#d4d4d4"
                      : a.count > 0
                        ? "#ca8a04"
                        : "#16a34a",
                }}
                aria-hidden
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className={styles.historyItemTitle}>
                  {a.label}{" "}
                  <Badge variant={(a.count ?? 0) > 0 ? "secondary" : "outline"}>
                    {a.count === null ? "…" : a.count}
                  </Badge>
                </p>
                <p className={styles.historyItemSub}>{a.hint}</p>
              </div>
              <Link
                className={styles.kpiBtnSolid}
                style={{ marginTop: 0 }}
                href={a.href}
                onClick={onClose}
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
