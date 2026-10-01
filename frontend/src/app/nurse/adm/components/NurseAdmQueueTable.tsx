"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deriveActionStatus } from "../../overview/components/nurse-overview-data";
import {
  formatActionTime,
  latestActionOf,
} from "../../referrals/components/nurse-referrals-format";
import {
  ACTION_STATUS_VARIANT,
  actionIconFor,
  statusVariant,
} from "../../alerts/components/NurseReferralsTable";
import {
  AdmQueueTable,
  type AdmQueueRowVM,
} from "@/components/adm-queue/AdmQueueTable";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import { NurseForwardAdmButton } from "../../overview/components/NurseForwardAdmButton";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "../../referrals/components/NurseAdmReferralFormSheet";
import type {
  NurseAlertItem,
  NurseRiskLevel,
} from "../../alerts/components/nurse-alerts-data";
import styles from "./nurse-adm.module.css";

/**
 * ADM cases needing nurse action — the shared ADM queue table fed by the
 * nurse adapter: nurse-scope rows mapped onto the shared list, nurse
 * actions (forward, review, referral form) injected per row. Terminal
 * rows (resolved, dismissed) are excluded here — they stay visible in the
 * alerts list and count in the reports above; this section is the working
 * set only.
 */
export function NurseAdmQueueTable({
  queue,
  riskByStudent,
  riskLoading = false,
  onChanged,
}: {
  queue: NurseAlertItem[];
  riskByStudent: Record<string, NurseRiskLevel>;
  riskLoading?: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseAlertItem["row"];
    draft: AdmReviewDraft;
  } | null>(null);

  const rows = React.useMemo<AdmQueueRowVM[]>(
    () =>
      queue
        .filter(
          (alert) =>
            alert.row.status !== "resolved" && alert.row.status !== "dismissed",
        )
        .map((alert) => {
          const row = alert.row;
          const actionStatus = deriveActionStatus(row.type, row.status, row.sessions);
          const latest = latestActionOf(row, alert);
          return {
            id: row.id,
            lrn: row.lrn,
            student: row.student,
            section: row.section,
            searchText: `${row.student} ${row.lrn} ${row.section} ${row.reason} ${row.category}`,
            statusLabel: actionStatus.label,
            statusVariant:
              ACTION_STATUS_VARIANT[actionStatus.key] ?? statusVariant(row.status),
            riskLevel: alert.studentId ? riskByStudent[alert.studentId] : undefined,
            latestLabel: latest.label,
            LatestIcon: actionIconFor(latest.label),
            actionTime: latest.time,
            dateReferred: formatActionTime(row.date),
          };
        }),
    [queue, riskByStudent]
  );

  const byId = React.useMemo(() => new Map(queue.map((a) => [a.row.id, a.row])), [queue]);

  const renderActions = React.useCallback(
    (id: string) => {
      const row = byId.get(id);
      if (!row) return null;
      // Same deep-links as the alerts table — the ADM page auto-scrolls
      // to and highlights the case, overlaying the filled referral form
      // when asked.
      const seeMoreHref = `/nurse/referrals/adm?highlight=${row.id}`;
      const viewFormHref = `${seeMoreHref}&form=1`;
      return (
        <div className={styles.cellActions}>
          {row.type === "ADM" && row.status === "pending" && row.referralReady && (
            <NurseForwardAdmButton id={row.id} student={row.student} onChanged={onChanged} />
          )}
          {row.type === "ADM" && row.status === "pending" && (
            <NurseAdmReviewDialog
              row={row}
              onChanged={onChanged}
              onCreateReferral={(draft) => setFormSheet({ row, draft })}
            />
          )}
          <NurseQueueRowActions
            row={row}
            onChanged={onChanged}
            seeMoreHref={seeMoreHref}
            viewFormHref={viewFormHref}
            viewOnly
          />
        </div>
      );
    },
    [byId, onChanged]
  );

  return (
    <>
      <AdmQueueTable
        title="Latest referrals needing action"
        description="The 5 most recent ADM cases waiting on your review, decision, or session work. Closed cases stay in the alerts list and count in the reports above."
        searchPlaceholder="Search student…"
        emptyTitle="No ADM cases need action"
        emptyHint="You're all caught up — new referrals will appear here."
        rows={rows}
        renderActions={renderActions}
        riskLoading={riskLoading}
        limit={5}
        onRowClick={(id) => router.push(`/nurse/referrals/adm?highlight=${id}`)}
      />

      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
