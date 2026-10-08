"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import refStyles from "./referrals.module.css";
import { ReferForm } from "./refer-form";
import { DismissedRereferCard } from "./dismissed-rerefer-card";
import { useAdmNotice } from "./use-adm-notice";
export function ReferStudentCard({
  open,
  onOpenChange,
  resubmitHintSignal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resubmitHintSignal?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const { noticeVisible, portalTarget, showReminder, handleNoticeClose } =
    useAdmNotice(resubmitHintSignal);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {noticeVisible && portalTarget
        ? createPortal(
            <div className={refStyles.admNotice} role="status" aria-live="polite">
              <AlertTriangle size={18} className={refStyles.admNoticeIcon} aria-hidden="true" />
              <div className={refStyles.admNoticeContent}>
                <p className={refStyles.admNoticeTitle}>ADM case cancelled</p>
                <p className={refStyles.admNoticeBody}>Re-submit from scratch — pick the record, type, and staff.</p>
              </div>
              <button type="button" className={refStyles.admNoticeClose} onClick={handleNoticeClose} aria-label="Dismiss notification">
                <X size={14} aria-hidden />
              </button>
            </div>,
            portalTarget,
          )
        : null}
      <div className={assign.card} aria-label="Refer a student">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Send size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>Refer student</h2>
            <p className={styles.sectionDesc}>
              Send an anecdotal record to a desk.
            </p>
          </div>
        </div>
        <div className="relative">
          <Button
            onClick={() => {
              setMounted(true);
              onOpenChange(true);
            }}
            aria-expanded={open}
            variant={open ? "outline" : "default"}
            className="w-full"
          >
            New referral
          </Button>
        </div>
      </div>
      <div
        className={`${refStyles.collapse} ${open ? refStyles.collapseOpen : ""}`}
        inert={!open}
      >
        <div className={refStyles.collapseInner}>
          {mounted ? <ReferForm onDone={() => onOpenChange(false)} /> : null}
        </div>
      </div>
      <DismissedRereferCard onOpenChange={onOpenChange} onAdmRerefer={showReminder} />
    </div>
  );
}
