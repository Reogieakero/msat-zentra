"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, TabletSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  fetchCoordinatorApprovals,
  fetchCoordinatorDevices,
  apiErrorMessage,
  type AdmDeviceRow,
} from "../components/coordinator-data";
import {
  CoordinatorDevicesTable,
  type DeviceFilter,
} from "./components/coordinator-devices-table";
import { CoordinatorDevicesIssueDialog } from "./components/coordinator-devices-issue-dialog";
import pageStyles from "../pages.module.css";

const DEVICE_PAGE_SIZE = 20;

function CoordinatorDevicesPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [filter, setFilter] = React.useState<DeviceFilter>("all");
  const [page, setPage] = React.useState(1);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [returnTarget, setReturnTarget] = React.useState<AdmDeviceRow | null>(null);
  /** Id of the device being returned — its row button shows `Recording…`
      while every other row stays usable. */
  const [returningId, setReturningId] = React.useState<string | null>(null);
  const debouncedRef = React.useRef("");
  // Deep-link from the sidebar needs-device reminder (?issue=1): open the
  // issue dialog once, then clear the param so it never reopens.
  const openedForIssue = React.useRef(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim();
      if (next === debouncedRef.current) return;
      debouncedRef.current = next;
      setDebounced(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (openedForIssue.current) return;
    if (searchParams.get("issue") === "1") {
      openedForIssue.current = true;
      setIssueOpen(true);
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  const devicesQuery = useQuery({
    queryKey: ["coordinator-devices", debounced, filter, page],
    queryFn: ({ signal }) =>
      fetchCoordinatorDevices({
        q: debounced || undefined,
        status: filter === "all" ? undefined : filter,
        page,
        limit: DEVICE_PAGE_SIZE,
        signal,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Principal-approved cases with no device issued yet — powers the
  // centered needs prompt and scopes the issue dialog's learner picker.
  const needsQuery = useQuery({
    queryKey: ["coordinator-devices", "needs-device"],
    queryFn: ({ signal }) =>
      fetchCoordinatorApprovals(1, { limit: 200, signal }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
  const needsDevice = React.useMemo(
    () =>
      (needsQuery.data?.rows ?? []).filter(
        (r) => (r.devicesIssued ?? 0) === 0,
      ),
    [needsQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-devices"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
  };

  const returnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/adm/devices/${id}/return`, {});
      return data;
    },
    onSuccess: (_data, id) => {
      // The returned row flips immediately — patch cached ledger pages
      // instead of waiting for the refetch.
      const today = new Date().toISOString().slice(0, 10);
      queryClient.setQueriesData<{ rows?: AdmDeviceRow[]; total?: number }>(
        { queryKey: ["coordinator-devices"] },
        (cached) => {
          if (!cached || !Array.isArray(cached.rows)) return cached;
          if (!cached.rows.some((r) => r.id === id)) return cached;
          return {
            ...cached,
            rows: cached.rows.map((r) =>
              r.id === id ? { ...r, status: "returned" as const, returnedDate: today } : r,
            ),
          };
        },
      );
      invalidate();
      setReturnTarget(null);
      toast.success({ title: "Device returned", description: "Return recorded." });
    },
    onError: (err) => toast.error({ title: "Could not record return", description: apiErrorMessage(err) }),
    onSettled: () => setReturningId(null),
  });

  const rows = React.useMemo(() => devicesQuery.data?.rows ?? [], [devicesQuery.data]);
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
  // Truly empty ledger (loaded, no error, no active filters): the table
  // (with its title + search) steps aside so one centered block owns the
  // page. Filtered-to-zero keeps the table so the search can be cleared.
  const ledgerTrulyEmpty =
    !devicesQuery.isPending &&
    !devicesQuery.isError &&
    !!devicesQuery.data &&
    rows.length === 0 &&
    !hasActiveFilters;

  return (
    <section className={pageStyles.page}>
      {ledgerTrulyEmpty ? (
        <div className={pageStyles.centerEmpty}>
          {showNeeds ? (
            <p className={pageStyles.needsMessage}>
              <TabletSmartphone aria-hidden="true" />
              {needsCountText}
            </p>
          ) : null}
          <p className={pageStyles.emptyHint}>No devices issued yet.</p>
          {showNeeds ? (
            <Button onClick={() => setIssueOpen(true)}>
              Issue device
            </Button>
          ) : null}
        </div>
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
            query={query}
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

      {/* Issue to an approved case without a device */}
      <CoordinatorDevicesIssueDialog
        open={issueOpen}
        candidates={needsDevice}
        candidatesPending={needsQuery.isPending}
        onClose={() => setIssueOpen(false)}
        onIssued={invalidate}
      />

      {/* Return confirm — same card-modal UI as every other dialog. */}
      <CardModal
        open={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
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
