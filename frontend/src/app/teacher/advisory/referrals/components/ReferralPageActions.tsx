"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Info, Send } from "lucide-react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { REFERRAL_STATUS_LEGEND } from "@/lib/labels/referral-status";

const STATUS_ENTRIES = REFERRAL_STATUS_LEGEND;

/**
 * Page actions on the top-right gutter of the referrals desk — the four
 * starters that used to live in the icon rail, flattened into 24px buttons so
 * they sit on one row next to the search field (same row as
 * /teacher/advisory/list).
 */
export function ReferralPageActions({ onNewReferral }: { onNewReferral?: () => void }) {
  const [legendOpen, setLegendOpen] = React.useState(false);

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        className="h-6 shrink-0 px-2 text-xs"
        onClick={onNewReferral}
      >
        <Send size={14} aria-hidden />
        New referral
      </Button>
      <Button asChild size="sm" variant="outline" className="h-6 shrink-0 px-2 text-xs">
        <Link href="/teacher/anecdotal">
          <FileText size={14} aria-hidden />
          Anecdotal records
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-6 shrink-0 px-2 text-xs">
        <Link href="/teacher/chat?standalone=1" target="_blank" rel="noopener noreferrer">
          <span className="inline-flex shrink-0 items-center" aria-hidden>
            <StudentMascot name="Bama" character="crt" size={14} />
          </span>
          Chat with Bama
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 shrink-0 px-2 text-xs"
        aria-haspopup="dialog"
        aria-expanded={legendOpen}
        onClick={() => setLegendOpen(true)}
      >
        <Info size={14} aria-hidden />
        Status legend
      </Button>

      <KanbanOverlay
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
        title="Status legend"
        ariaLabel="Referral status legend"
        icon={
          <span className="text-amber-500" aria-hidden>
            <Info size={16} />
          </span>
        }
        width="md"
      >
        <ul className="flex min-w-0 flex-row flex-wrap content-center items-center gap-1.5 px-1 pb-1">
          {STATUS_ENTRIES.map((entry) => (
            <li key={entry.key} className="flex">
              <Pill tone={entry.tone} label={entry.hint}>
                {entry.label}
              </Pill>
            </li>
          ))}
        </ul>
      </KanbanOverlay>
    </div>
  );
}
