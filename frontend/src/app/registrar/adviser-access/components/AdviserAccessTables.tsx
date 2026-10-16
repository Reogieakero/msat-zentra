"use client";

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
  return <SharedPendingDecisionTable {...props} desk="registrar" pageSize={15} />;
}

export function AdviserAccessKanban(props: {
  requests: AdviserAccessRequest[];
  onCheck: (id: string) => void;
  checkingId: string | null;
  onDeny: DenyFn;
  denyingId: string | null;
}) {
  return <SharedKanban {...props} desk="registrar" />;
}

export function HistoryTable(props: { requests: AdviserAccessRequest[] }) {
  return <SharedHistoryTable {...props} pageSize={15} />;
}
