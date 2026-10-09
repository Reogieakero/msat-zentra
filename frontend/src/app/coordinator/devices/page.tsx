"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, TabletSmartphone } from "lucide-react";
import { CoordinatorEmptyCard } from "../components/CoordinatorEmptyCard";
import { CoordinatorPageHeader } from "../components/CoordinatorPageHeader";
import { PageHeaderSkeleton } from "@/app/principal/components/skeletons/PageHeaderSkeleton";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import {
  fetchCoordinatorApprovals,
  fetchCoordinatorDevices,
} from "@/services/coordinator/overview.service";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import {
  CoordinatorDevicesTable,
  type DeviceFilter,
} from "./components/coordinator-devices-table";
import { CoordinatorDevicesIssueDialog } from "./components/coordinator-devices-issue-dialog";
import pageStyles from "../pages.module.css";

const DEVICE_PAGE_SIZE = 15;

function CoordinatorDevicesPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [queryInput, setQueryInput] = React.useState("");

  const debounced = useDebouncedValue(queryInput.trim(), 300);
  const [filter, setFilter] = React.useState<DeviceFilter>("all");
  const [page, setPage] = React.useState(1);

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
    setPage(1);
  }, []);

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
      fetchCoordinatorApprovals(1, { limit: 15, signal }),
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
      setReturnTarget(null);
      toast.success({ title: "Device returned", description: "Return recorded." });
    },
    onError: (err) => toast.error({ title: "Could not record return", description: apiErrorMessage(err) }),
    onSettled: () => setReturningId(null),
  });

  const rows = React.useMemo(
    () => (Array.isArray(devicesQuery.data?.rows) ? devicesQuery.data.rows : []),
    [devicesQuery.data],
  );

  const deviceTotal = devicesQuery.data?.total ?? 0;
  const deviceTotalPages = devicesQuery.data?.totalPages ?? 1;

  const deviceSafePage = Math.min(page, deviceTotalPages);
  const deviceLimit = devicesQuery.data?.limit ?? DEVICE_PAGE_SIZE;
  const deviceStart = deviceTotal === 0 ? 0 : (deviceSafePage - 1) * deviceLimit + 1;
  const deviceEnd = Math.min(deviceSafePage * deviceLimit, deviceTotal);
  const deviceBackground = devicesQuery.isFetching && !devicesQuery.isPending;

  const hasActiveFilters = filter !== "all" || debounced !== "";
  const statusLabel =
    filter === "issued" ? "Issued" : filter === "returned" ? "Returned" : "Status";

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
    setPage(1);
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
      {devicesQuery.isPending ? (
        <PageHeaderSkeleton withActions />
      ) : ledgerTrulyEmpty ? null : (
        <CoordinatorPageHeader
          title="Learning Devices"
          description="Tablets issued to ADM learners — issue new devices and record returns."
          actions={
            showNeeds ? (
              <Button onClick={() => setIssueOpen(true)}>Issue device</Button>
            ) : undefined
          }
        />
      )}
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

          <CoordinatorDevicesTable
            rows={rows}
            isPending={devicesQuery.isPending}
            isError={devicesQuery.isError || !devicesQuery.data}
            isRefetching={devicesQuery.isRefetching}
            query={queryInput}
            onQueryChange={setQuery}
            filter={filter}
            statusLabel={statusLabel}
            onFilterChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            returningId={returningId}
            total={deviceTotal}
            start={deviceStart}
            end={deviceEnd}
            page={deviceSafePage}
            totalPages={deviceTotalPages}
            isBackground={deviceBackground}
            onRetry={() => devicesQuery.refetch()}
            onPageChange={(next) => setPage(next)}
            onRecordReturn={setReturnTarget}
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

      <CardModal
        open={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        dismissable={!returnMutation.isPending}
        title="Record device return?"
        description={
          returnTarget ? (
            <>
              {returnTarget.deviceType} ({returnTarget.deviceSerial}) issued to{" "}
              {returnTarget.student} will be marked returned today.
            </>
          ) : undefined
        }
        size="sm"
      >
        <div className={pageStyles.modalActions}>
          <Button
            variant="outline"
            onClick={() => setReturnTarget(null)}
            disabled={returnMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            disabled={returnMutation.isPending}
            aria-busy={returnMutation.isPending || undefined}
            onClick={() => {
              if (returnTarget && !returnMutation.isPending) {
                setReturningId(returnTarget.id);
                returnMutation.mutate(returnTarget.id);
              }
            }}
          >
            {returnMutation.isPending ? <Loader2 className={pageStyles.spin} aria-hidden="true" /> : null}
            {returnMutation.isPending ? "Recording…" : "Record return"}
          </Button>
        </div>
      </CardModal>
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
