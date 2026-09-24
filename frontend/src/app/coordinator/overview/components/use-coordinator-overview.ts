import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  fetchCoordinatorDashboard,
  fetchCoordinatorDevices,
  fetchCoordinatorReferrals,
  stageLabel,
  useNowTick,
} from "../../components/coordinator-data";
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
    staleTime: 30_000,
  });

  // Device summary + the 5 longest-out issued tablets. Dedicated params mean
  // a dedicated cache entry — the Devices page list (unbounded) is untouched.
  const devicesQuery = useQuery({
    queryKey: ["coordinator-devices", "issued", "oldest", 5],
    queryFn: ({ signal }) =>
      fetchCoordinatorDevices({ status: "issued", order: "oldest", limit: 5, signal }),
    staleTime: 30_000,
  });

  // Fresh forwards still at consultation — the nurse/guidance hand-off queue.
  const forwardsQuery = useQuery({
    queryKey: ["coordinator-referrals", 1, "", "consultation"],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(1, { stage: "consultation", signal }),
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
  const awaitingPrincipal = data?.kpis.pendingSignature ?? 0;
  const activeEnrolled = React.useMemo(
    () => countFor(data?.stageBreakdown, "enrollment_monitoring"),
    [data],
  );

  const stageDonut: StageDonutEntry[] = React.useMemo(
    () =>
      (data?.stageBreakdown ?? []).map((s, i) => ({
        name: SHORT_STAGE[s.stage] ?? s.stage,
        full: stageLabel(s.stage),
        value: s.count,
        fill: STAGE_COLORS[i % STAGE_COLORS.length],
      })),
    [data],
  );

  const recentRows = React.useMemo(
    () => (forwardsQuery.data?.rows ?? []).slice(0, 5),
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
  const oldestOut = React.useMemo(() => {
    const rows = devicesQuery.data?.rows ?? [];
    const issuedOnly = rows.filter((d) => d.status === "issued");
    if (issuedOnly.length !== rows.length) return issuedOnly.slice(0, 5);
    return rows.slice(0, 5);
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
