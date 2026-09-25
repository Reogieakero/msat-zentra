"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ELIGIBILITY_LABELS,
  gradeLabel,
  initialsOf,
  stageOrder,
  toneOf,
  type AdmCase,
} from "./adm-cases-data";
import styles from "./AdmCaseCard.module.css";

interface AdmCaseCardProps {
  caseData: AdmCase;
  onDetails: () => void;
}

const MAX_TILT = 7;

/**
 * Profile-style case card (avatar, handle, status, stats, actions) with a
 * subtle pointer tilt. Read-only — stage and status only.
 */
export function AdmCaseCard({ caseData, onDetails }: AdmCaseCardProps) {
  const cardRef = React.useRef<HTMLElement>(null);
  const initials = initialsOf(caseData.studentName);
  const tone = toneOf(caseData.lrn || caseData.studentId);
  const order = stageOrder(caseData.stage);
  const progress = Math.round((order / 8) * 100);

  function handleMove(e: React.MouseEvent) {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * MAX_TILT).toFixed(2)}deg) rotateY(${(px * MAX_TILT).toFixed(2)}deg)`;
    el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
  }

  function handleLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "";
  }

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${styles[`tone${tone}`]}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-label={`ADM case for ${caseData.studentName}, stage ${order} of 8, ${caseData.approved ? "approved" : "pending approval"}`}
    >
      <span className={styles.glow} aria-hidden />

      <div className={styles.topRow}>
        <span className={styles.miniAvatar} aria-hidden>
          {initials}
        </span>
        <span className={styles.handle}>
          <span className={styles.handleLrn}>LRN {caseData.lrn}</span>
          <span className={styles.handleSection}>{caseData.section}</span>
        </span>
        <span
          className={`${styles.dot} ${caseData.approved ? styles.dotApproved : styles.dotPending}`}
          title={caseData.approved ? "Approved" : "Pending approval"}
        >
          <span className={styles.srOnly}>{caseData.approved ? "Approved" : "Pending approval"}</span>
        </span>
      </div>

      <div className={styles.avatarWrap}>
        <span
          className={styles.avatar}
          style={{ "--progress": `${progress}%` } as React.CSSProperties}
          aria-hidden
        >
          {initials}
        </span>
        <Badge variant={caseData.approved ? "success" : "warning"}>
          {caseData.approved ? "Approved" : "Pending"}
        </Badge>
      </div>

      <h3 className={styles.name}>{caseData.studentName}</h3>
      <p className={styles.sub}>
        {caseData.section} · {gradeLabel(caseData.gradeLevel)}
      </p>

      <div className={styles.stageRow}>
        <span className={styles.stageText}>
          Stage {order} of 8 · {caseData.stageLabel}
        </span>
        <span className={styles.bar} aria-hidden>
          <span className={styles.barFill} style={{ width: `${progress}%` }} />
        </span>
      </div>

      <div className={styles.metaRow}>
        <Badge variant="outline">{ELIGIBILITY_LABELS[caseData.eligibilityStatus] ?? caseData.eligibilityStatus}</Badge>
        <span className={styles.meta}>
          Modules {caseData.modulesSubmitted}/{caseData.modulesTotal}
        </span>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="default" size="sm" onClick={onDetails}>
          Track case
        </Button>
      </div>
    </article>
  );
}
