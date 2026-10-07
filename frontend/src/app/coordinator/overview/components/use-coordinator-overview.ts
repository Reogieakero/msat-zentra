import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  fetchCoordinatorDashboard,
  fetchCoordinatorDevices,
  fetchCoordinatorReferrals,
} from "@/services/coordinator/overview.service";
import { stageLabel } from "@/services/coordinator/labels";
import { useNowTick } from "@/services/coordinator/utils";
import {
  countFor,
  SHORT_STAGE,
  STAGE_COLORS,
  type AttentionItem,
  type StageDonutEntry,
} from "./coordinator-overview-helpers";

export interface CoordinatorOverviewModel {
  now: number;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  isRefetching: boolean;
  referredToMe: number;
  certificationsIssued: number;
  awaitingPrincipal: number;
  activeEnrolled: number;
  stageDonut: StageDonutEntry[];
  attention: AttentionItem[];
  attentionReady: boolean;
  attentionError: boolean;
  allClear: boolean;
  attentionTotal: number;
  forwards: {
    rows: NonNullable<
      Awaited<ReturnType<typeof fetchCoordinatorReferrals>>["rows"]
    >;
    isPending: boolean;
    isError: boolean;
    isRefetching: boolean;
    refetch: () => void;
  };
  devices: {
    data: Awaited<ReturnType<typeof fetchCoordinatorDevices>> | undefined;
    isPending: boolean;
    isError: boolean;
    isRefetching: boolean;
    refetch: () => void;
    oldestOut: NonNullable<
      Awaited<ReturnType<typeof fetchCoordinatorDevices>>["rows"]
    >;
    devicesOut: number | null;
  };
}

export function useCoordinatorOverview(): CoordinatorOverviewModel {
  const now = useNowTick();

  const dashboardQuery = useQuery({
    queryKey: ["coordinator-dashboard"],
    queryFn: ({ signal }) => fetchCoordinatorDashboard(signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Device preview — same fetcher + backend order as the Devices ledger
  // (status=issued, oldest first), paging at the list size so preview and
  // list stay comparable. Dedicated preview key suffix so it never poisons
  // the paged list cache.
  const devicesQuery = useQuery({
    queryKey: ["coordinator-devices", "preview", "issued", "oldest", 15],
    queryFn: ({ signal }) =>
      fetchCoordinatorDevices({ status: "issued", order: "oldest", limit: 15, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Fresh forwards still at consultation — the nurse/guidance hand-off queue.
  // Same fetcher + columns + backend order as the referrals list; preview
  // pager matches the list size (15) so counts stay comparable.
  const forwardsQuery = useQuery({
    queryKey: ["coordinator-referrals", "preview", 1, "", "consultation", 15],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(1, { stage: "consultation", limit: 15, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const data = dashboardQuery.data;
  // Page-level gate covers the dashboard only. Forwards/devices render
  // independently below so one slow widget never blanks the KPIs.
  const isPending = dashboardQuery.isPending;
  const isError = dashboardQuery.isError || !data;

  const referredToMe = React.useMemo(() => {
    if (typeof data?.totalReferred === "number") return data.totalReferred;
    // Fallback for a stale cached payload from before the summary fields.
    return countFor(
      data?.stageBreakdown,
      "consultation",
      "meeting_parents",
      "home_visitation",
      "certification",
      "principal_approval",
    );
  }, [data]);

  const certificationsIssued = React.useMemo(
    () =>
      countFor(
        data?.stageBreakdown,
        "certification",
        "principal_approval",
        "enrollment_monitoring",
        "completion",
      ),
    [data],
  );
  const awaitingPrincipal = data?.kpis?.pendingSignature ?? 0;
  const activeEnrolled = React.useMemo(
    () => countFor(data?.stageBreakdown, "enrollment_monitoring"),
    [data],
  );

  const stageDonut: StageDonutEntry[] = React.useMemo(
    () =>
      (Array.isArray(data?.stageBreakdown) ? data.stageBreakdown : []).map((s, i) => ({
        name: SHORT_STAGE[s.stage] ?? s.stage,
        full: stageLabel(s.stage),
        value: s.count,
        fill: STAGE_COLORS[i % STAGE_COLORS.length],
      })),
    [data],
  );

  // Full consultation queue — the table paginates client-side (5 per page).
  // Array-guarded: non-array payloads (cached/error shapes) never crash it.
  const recentRows = React.useMemo(
    () => (Array.isArray(forwardsQuery.data?.rows) ? forwardsQuery.data.rows : []),
    [forwardsQuery.data],
  );
  const newReferrals = React.useMemo(
    () => countFor(data?.stageBreakdown, "consultation"),
    [data],
  );
  const needsRevision = data?.needsRevision ?? null;
  const devicesOut = React.useMemo(() => {
    if (typeof data?.deviceSummary?.issued === "number")
      return data.deviceSummary.issued;
    return devicesQuery.data?.issued ?? null;
  }, [data, devicesQuery.data]);

  const attention: AttentionItem[] = React.useMemo(
    () => [
      {
        label: "New referrals with no profile",
        count: newReferrals,
        href: "/coordinator/referrals",
        hint: "Create the learner profile to start the case",
      },
      {
        label: "Needs revision",
        count: needsRevision,
        href: "/coordinator/certifications?tab=revision",
        hint: "Returned by the Principal or forwarded incomplete",
      },
      {
        label: "Devices still out",
        count: devicesOut,
        href: "/coordinator/devices",
        hint: "Issued tablets not yet returned",
      },
    ],
    [newReferrals, needsRevision, devicesOut],
  );
  const attentionError = devicesQuery.isError;
  // Dashboard counts alone unlock Review; a devices failure only marks its
  // own row unavailable instead of blocking the whole dialog.
  const attentionReady = data !== undefined && needsRevision !== null;
  const allClear =
    attentionReady &&
    !attentionError &&
    attention.every((a) => (a.count ?? 0) === 0);
  const attentionTotal = React.useMemo(
    () => attention.reduce((sum, a) => sum + (a.count ?? 0), 0),
    [attention],
  );

  // Server already returns the oldest-issued first; keep a client-side guard
  // so the order holds even for a stale pre-change cached payload.
  // Preview pages at the list size (15).
  const oldestOut = React.useMemo(() => {
    const raw = devicesQuery.data?.rows;
    const rows = Array.isArray(raw) ? raw : [];
    const issuedOnly = rows.filter((d) => d.status === "issued");
    if (issuedOnly.length !== rows.length) return issuedOnly.slice(0, 15);
    return rows.slice(0, 15);
  }, [devicesQuery.data]);

  return {
    now,
    isPending,
    isError,
    refetch: () => {
      void dashboardQuery.refetch();
    },
    isRefetching: dashboardQuery.isRefetching,
    referredToMe,
    certificationsIssued,
    awaitingPrincipal,
    activeEnrolled,
    stageDonut,
    attention,
    attentionReady,
    attentionError,
    allClear,
    attentionTotal,
    forwards: {
      rows: recentRows,
      isPending: forwardsQuery.isPending,
      isError: forwardsQuery.isError,
      isRefetching: forwardsQuery.isRefetching,
      refetch: () => {
        void forwardsQuery.refetch();
      },
    },
    devices: {
      data: devicesQuery.data,
      isPending: devicesQuery.isPending,
      isError: devicesQuery.isError,
      isRefetching: devicesQuery.isRefetching,
      refetch: () => {
        void devicesQuery.refetch();
      },
      oldestOut,
      devicesOut,
    },
  };
}
