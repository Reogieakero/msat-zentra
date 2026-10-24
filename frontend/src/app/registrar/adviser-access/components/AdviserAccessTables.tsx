"use client";

import { PAGE_SIZE } from "@/components/shared/pagination";
import {
  HistoryTable as SharedHistoryTable,
  AdviserAccessKanban as SharedKanban,
  PendingDecisionTable as SharedPendingDecisionTable,
  TableSkeleton,
  type DenyFn,
} from "@/components/shared/adviser-access/AdviserAccessTables";
import type { AdviserAccessRequest } from "./types";

export { TableSkeleton };

type ActFn = (id: string, approved: boolean, reason?: string) => Promise<void>;

export function PendingDecisionTable(props: {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  actingApprove?: boolean | null;
  onActed: ActFn;
  onCheck: (id: string) => Promise<void>;
  checkingId: string | null;
}) {
  return <SharedPendingDecisionTable {...props} desk="registrar" pageSize={PAGE_SIZE} />;
}

export function AdviserAccessKanban(props: {
  requests: AdviserAccessRequest[];
  onCheck: (id: string) => void;
  checkingId: string | null;
  onDeny: DenyFn;
  denyingId: string | null;
}) {
  // animateOnMount: same staggered card cascade as the final-grades RowList
  // (mirrors the record-keeper page).
  return <SharedKanban {...props} desk="registrar" animateOnMount />;
}

export function HistoryTable(props: { requests: AdviserAccessRequest[] }) {
  return <SharedHistoryTable {...props} pageSize={PAGE_SIZE} />;
}
