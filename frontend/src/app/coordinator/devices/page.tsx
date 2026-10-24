"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { TabletSmartphone } from "lucide-react";
import { CoordinatorEmptyCard } from "../components/CoordinatorEmptyCard";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { useDock } from "@/components/dock/dock-store";
import {
  fetchCoordinatorApprovals,
  fetchCoordinatorDevices,
} from "@/services/coordinator/overview.service";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import {
  CoordinatorDevicesBoard,
  type DeviceFilter,
} from "./components/coordinator-devices-board";
import { CoordinatorDevicesIssueDialog } from "./components/coordinator-devices-issue-dialog";
import { CoordinatorDeviceReturnOverlay } from "./components/coordinator-device-return-overlay";
import pageStyles from "../pages.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";

const DEVICE_PAGE_SIZE = PAGE_SIZE;

function CoordinatorDevicesPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { startTask, completeTask, failTask } = useDock();
  const dockTaskRef = React.useRef<string | null>(null);
  const [queryInput, setQueryInput] = React.useState(
    () => searchParams.get("q") ?? "",
  );

  const debounced = useDebouncedValue(queryInput.trim(), 300);
  const [filter, setFilterState] = React.useState<DeviceFilter>(() => {
    const s = searchParams.get("status");
    return s === "issued" || s === "returned" ? s : "all";
  });
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "status"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const setFilter = React.useCallback(
    (v: DeviceFilter) => {
      setFilterState(v);
      pager.setFilters({ status: v === "all" ? undefined : v });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [issueOpen, setIssueOpen] = React.useState(
    () => searchParams.get("issue") === "1",
  );
  const [returnTarget, setReturnTarget] = React.useState<AdmDeviceRow | null>(null);

  const [returningId, setReturningId] = React.useState<string | null>(null);
  const issueParamCleared = React.useRef(false);
  React.useEffect(() => {
    if (issueParamCleared.current) return;
    if (searchParams.get("issue") === "1") {
      issueParamCleared.current = true;
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);
  const setQuery = React.useCallback((v: string) => {
    setQueryInput(v);
  }, []);

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const devicesQuery = useQuery({
    queryKey: ["coordinator-devices", page, debounced, filter, DEVICE_PAGE_SIZE],
    queryFn: ({ signal }) =>
      fetchCoordinatorDevices({
        q: debounced || undefined,
        status: filter === "all" ? undefined : filter,
        page,
        limit: DEVICE_PAGE_SIZE,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const needsQuery = useQuery({
    queryKey: ["coordinator-devices", "preview", "needs-device"],
    queryFn: ({ signal }) =>
      fetchCoordinatorApprovals(1, { limit: PAGE_SIZE, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const needsDevice = React.useMemo(
    () =>
      (Array.isArray(needsQuery.data?.rows) ? needsQuery.data.rows : []).filter(
        (r) => (r.devicesIssued ?? 0) === 0,
      ),
    [needsQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-devices"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
  };

  const returnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/adm/devices/${id}/return`, {});
      return data;
    },

    onSuccess: (data, id) => {
      void data;
      markSelfNotified(id);
      invalidate();
      if (dockTaskRef.current) {
        completeTask(dockTaskRef.current, "Marked returned today.");
        dockTaskRef.current = null;
      }
      setReturnTarget(null);
      toast.success({ title: "Device returned", description: "Return recorded." });
    },
    onError: (err) => {
      if (dockTaskRef.current) {
        failTask(dockTaskRef.current, apiErrorMessage(err));
        dockTaskRef.current = null;
      }
      toast.error({ title: "Could not record return", description: apiErrorMessage(err) });
    },
    onSettled: () => setReturningId(null),
  });

  const rows = React.useMemo(
    () => (Array.isArray(devicesQuery.data?.rows) ? devicesQuery.data.rows : []),
    [devicesQuery.data],
  );

  const deviceTotal = devicesQuery.data?.total ?? 0;
  const deviceTotalPages = devicesQuery.data?.totalPages ?? 1;

  const deviceSafePage = Math.min(page, deviceTotalPages);
  const deviceBackground = devicesQuery.isFetching && !devicesQuery.isPending;

  // Prefetch the next page while the user views the current one.
  React.useEffect(() => {
    if (page >= deviceTotalPages) return;
    void queryClient.prefetchQuery({
      queryKey: ["coordinator-devices", page + 1, debounced, filter, DEVICE_PAGE_SIZE],
      queryFn: ({ signal }) =>
        fetchCoordinatorDevices({
          q: debounced || undefined,
          status: filter === "all" ? undefined : filter,
          page: page + 1,
          limit: DEVICE_PAGE_SIZE,
          signal,
        }),
      staleTime: 30_000,
    });
  }, [queryClient, page, debounced, filter, deviceTotalPages]);

  const hasActiveFilters = filter !== "all" || debounced !== "";

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
    setPage(1);
  };

  const confirmReturn = () => {
    if (!returnTarget || returnMutation.isPending) return;
    dockTaskRef.current = startTask({
      kind: "generic",
      title: "Recording device return",
      description: `${returnTarget.deviceType} (${returnTarget.deviceSerial}) · ${returnTarget.student}`,
    });
    setReturningId(returnTarget.id);
    setReturnTarget(null);
    returnMutation.mutate(returnTarget.id);
  };

  const showNeeds = !needsQuery.isPending && needsDevice.length > 0;
  const needsCountText = `${needsDevice.length} principal-approved case${
    needsDevice.length === 1 ? "" : "s"
  } still ${needsDevice.length === 1 ? "needs" : "need"} a device.`;

  const ledgerTrulyEmpty =
    !devicesQuery.isPending &&
    !devicesQuery.isError &&
    !!devicesQuery.data &&
    rows.length === 0 &&
    !hasActiveFilters;

  return (
    <section
      className={ledgerTrulyEmpty ? `${pageStyles.page} ${pageStyles.pageEmpty}` : pageStyles.page}
      aria-label="Learning devices"
      aria-busy={devicesQuery.isPending || undefined}
    >
      {ledgerTrulyEmpty ? (
        <CoordinatorEmptyCard
          icon={TabletSmartphone}
          title="No devices issued yet"
          hint={
            showNeeds
              ? needsCountText
              : "Devices you issue to principal-approved cases will appear here."
          }
          label="Learning devices"
          action={
            showNeeds ? (
              <Button onClick={() => setIssueOpen(true)}>Issue device</Button>
            ) : undefined
          }
          centered
        />
      ) : (
        <>
          {showNeeds ? (
            <div className={pageStyles.needsPrompt}>
              <p className={pageStyles.needsMessage}>
                <TabletSmartphone aria-hidden="true" />
                {needsCountText}
              </p>
              <Button onClick={() => setIssueOpen(true)}>
                Issue device
              </Button>
            </div>
          ) : null}

          <CoordinatorDevicesBoard
            rows={rows}
            isPending={devicesQuery.isPending}
            isError={devicesQuery.isError || !devicesQuery.data}
            isRefetching={devicesQuery.isRefetching}
            query={queryInput}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            returningId={returningId}
            total={deviceTotal}
            page={deviceSafePage}
            isBackground={deviceBackground}
            onRetry={() => devicesQuery.refetch()}
            onPageChange={(next) => setPage(next)}
            onRecordReturn={setReturnTarget}
            onIssueDevice={() => setIssueOpen(true)}
          />
        </>
      )}

      <CoordinatorDevicesIssueDialog
        open={issueOpen}
        candidates={needsDevice}
        candidatesPending={needsQuery.isPending}
        onClose={() => setIssueOpen(false)}
        onIssued={invalidate}
      />

      <CoordinatorDeviceReturnOverlay
        row={returnTarget}
        pending={returnMutation.isPending}
        onClose={() => setReturnTarget(null)}
        onConfirm={confirmReturn}
      />
    </section>
  );
}

export default function CoordinatorDevicesPage() {
  return (
    <React.Suspense>
      <CoordinatorDevicesPageInner />
    </React.Suspense>
  );
}
