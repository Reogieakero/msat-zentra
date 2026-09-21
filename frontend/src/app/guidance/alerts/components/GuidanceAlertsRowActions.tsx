"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import type { GuidanceReferralItem } from "../../referrals/components/guidance-referrals-data";
import { formatActionTime, sessionTypeLabel } from "../../referrals/components/guidance-referrals-format";
import type { AtRiskStudentItem } from "../../interventions/components/guidance-interventions-data";
import styles from "./guidance-alerts-table.module.css";

function sessionStatusVariant(status: string): "default" | "success" | "secondary" | "outline" {
  switch (status) {
    case "scheduled":
      return "default";
    case "completed":
      return "success";
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Per-row 3-dots menu for adviser-referred rows (ADM / Counseling) — the
 * same entries as the nurse alerts menu: View referral form (ADM only),
 * View anecdotal report, See more. The two link entries jump to the
 * highlighted case on its home page without overlaying anything; the
 * filled form and the report open from the case page itself. Handling
 * stays on the case pages.
 */
export function GuidanceAlertsRowActions({ row }: { row: GuidanceReferralItem }) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [endorsedOpen, setEndorsedOpen] = React.useState(false);

  const isClosed = row.status === "resolved" || row.status === "dismissed";
  // Endorsed ADM cases moved to the coordinator with their full report —
  // the anecdotal write-up is no longer viewable on this desk.
  const isEndorsedRow = row.type === "ADM" && row.status === "in_progress";

  const homeHref =
    row.type === "ADM" ? "/guidance/referrals/adm" : "/guidance/referrals/counseling";
  // Same deep-links as the nurse menu: both entries jump to the
  // highlighted case on its home page — no overlay. The filled form and
  // the anecdotal report open from the case page itself.
  const seeMoreHref = `${homeHref}?highlight=${row.id}`;
  const viewFormHref = row.type === "ADM" ? seeMoreHref : null;

  function openReport() {
    if (isEndorsedRow) {
      setEndorsedOpen(true);
      return;
    }
    if (!row.anecdotalId) return;
    // Finished cases keep the full write-up hidden; the reason on this
    // page stays visible.
    if (isClosed) setPrivacyOpen(true);
    else setPreviewId(row.anecdotalId);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${row.student}'s case`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {viewFormHref && (
            <DropdownMenuItem asChild>
              <Link href={viewFormHref}>View referral form</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={!row.anecdotalId && !isEndorsedRow}
            onSelect={openReport}
          >
            View anecdotal report
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={seeMoreHref}>See more</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {previewId && (
        <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
      )}
      <PrivacyNoticeDialog
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        studentName={row.student}
      />
      <PrivacyNoticeDialog
        open={endorsedOpen}
        onClose={() => setEndorsedOpen(false)}
        studentName={row.student}
        reason="endorsed"
      />
    </>
  );
}

/**
 * 3-dots menu for engine intervention rows: Booked session (read-only list
 * of the intervention's sessions) and See more (the interventions desk,
 * where sessions and outcomes are managed).
 */
export function GuidanceInterventionRowActions({ item }: { item: AtRiskStudentItem }) {
  const [sessionsOpen, setSessionsOpen] = React.useState(false);
  const sessions = item.intervention?.sessions ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${item.student}'s intervention`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onSelect={() => setSessionsOpen(true)}>
            Booked session
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/guidance/interventions">See more</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {sessionsOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSessionsOpen(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booked sessions</DialogTitle>
              <DialogDescription>
                Intervention sessions for {item.student}.
              </DialogDescription>
            </DialogHeader>
            {sessions.length === 0 ? (
              <p className={styles.empty}>No sessions booked for this intervention yet.</p>
            ) : (
              <ul className={styles.sessList}>
                {sessions.map((s) => (
                  <li key={s.id} className={styles.sessItem}>
                    <div className={styles.sessMain}>
                      <p className={styles.sessTitle}>{sessionTypeLabel(s.sessionType)}</p>
                      <p className={styles.sessSub}>
                        {formatActionTime(s.scheduledAt)}
                        {s.venue ? ` · ${s.venue}` : ""}
                      </p>
                    </div>
                    <Badge variant={sessionStatusVariant(s.status)}>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
