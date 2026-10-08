"use client";

import {
  HistoryTable as SharedHistoryTable,
  PendingDecisionTable as SharedPendingDecisionTable,
  TableSkeleton,
} from "@/components/shared/adviser-access/AdviserAccessTables";
import type { AdviserAccessRequest } from "./types";

export { TableSkeleton };

type ActFn = (id: string, approved: boolean, reason?: string) => Promise<void>;

export function PendingDecisionTable(props: {
  requests: AdviserAccessRequest[];
  actingId: string | null;
  actingApprove?: boolean | null;
  onActed: ActFn;
}) {
  return <SharedPendingDecisionTable {...props} pageSize={15} />;
}

export function HistoryTable(props: { requests: AdviserAccessRequest[] }) {
  return <SharedHistoryTable {...props} pageSize={15} />;
}
