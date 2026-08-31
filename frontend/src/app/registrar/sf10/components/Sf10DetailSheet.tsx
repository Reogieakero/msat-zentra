"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckCircle2, Archive } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { StatusBadge, formatRelativeTime } from "./shared";
import { GRADE_LABEL, SF10_SOURCE_LABEL, type Sf10Record } from "../types";
import { validateSf10, releaseSf10 } from "../api";
import styles from "../sf10.module.css";

export function Sf10DetailSheet({
  record,
  open,
  onOpenChange,
  onChanged,
}: {
  record: Sf10Record | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [acting, setActing] = React.useState<"validate" | "release" | null>(null);

  if (!record) return null;

  const handleValidate = async () => {
    setActing("validate");
    try {
      await validateSf10(record.id);
      toast.success({ title: "Validated", description: `${record.fullName} marked available.` });
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error({ title: "Validation failed" });
    } finally {
      setActing(null);
    }
  };

  const handleRelease = async () => {
    setActing("release");
    try {
      await releaseSf10(record.id);
      toast.success({ title: "Released", description: `${record.fullName} released & archived.` });
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error({ title: "Release failed" });
    } finally {
      setActing(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{record.fullName}</SheetTitle>
          <SheetDescription className={styles.lrn}>{record.lrn}</SheetDescription>
        </SheetHeader>

        <div className={styles.sheetBody}>
          <div className="flex items-center gap-2">
            <StatusBadge status={record.status} />
            <span className={styles.muted}>
              {GRADE_LABEL[record.gradeLevel]} · {record.section} ·{" "}
              {SF10_SOURCE_LABEL[record.source]}
            </span>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Uploaded</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.uploadedAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Verified by</span>
              <span className={styles.metaValue}>{record.verifiedBy ?? "—"}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Validated by</span>
              <span className={styles.metaValue}>{record.validatedBy ?? "—"}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Released</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.releasedAt)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Current version</span>
              <span className={styles.metaValue}>v{record.currentVersion}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Last updated</span>
              <span className={styles.metaValue}>{formatRelativeTime(record.updatedAt)}</span>
            </div>
          </div>

          {record.uploadedFileUrl ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={record.uploadedFileUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink />
                Open SF10 file
              </a>
            </Button>
          ) : null}

          <div>
            <p className={styles.sectionLabel}>Version history</p>
            <div className={styles.timeline}>
              {record.versions.map((v) => (
                <div key={v.versionNumber} className={styles.timelineRow}>
                  <span>
                    <span className={styles.name}>v{v.versionNumber}</span>{" "}
                    <span className={styles.timelineReason}>— {v.changeReason}</span>
                  </span>
                  <span className={styles.muted}>{formatRelativeTime(v.changedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.sheetActions}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={record.status !== "attach" || acting !== null}
            onClick={handleValidate}
          >
            <CheckCircle2 />
            {acting === "validate" ? "Validating…" : "Validate"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={record.status !== "available" || acting !== null}
            onClick={handleRelease}
          >
            <Archive />
            {acting === "release" ? "Releasing…" : "Release & archive"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
