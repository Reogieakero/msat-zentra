"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search, TabletSmartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  fetchCoordinatorDevices,
  fetchCoordinatorReferrals,
  apiErrorMessage,
  type AdmDeviceRow,
} from "../components/coordinator-data";
import pageStyles from "../pages.module.css";

type DeviceFilter = "all" | "issued" | "returned";

const DEVICE_TYPE_OPTIONS = ["Tablet", "Phone", "Laptop", "Chromebook"] as const;

const STATUS_OPTIONS: { value: DeviceFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "issued", label: "Issued" },
  { value: "returned", label: "Returned" },
];

const DEVICE_PAGE_SIZE = 20;

export default function CoordinatorDevicesPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [filter, setFilter] = React.useState<DeviceFilter>("all");
  const [page, setPage] = React.useState(1);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [returnTarget, setReturnTarget] = React.useState<AdmDeviceRow | null>(null);
  const [profileId, setProfileId] = React.useState("");
  const [deviceType, setDeviceType] = React.useState("Tablet");
  const [deviceSerial, setDeviceSerial] = React.useState("");
  const [conditionNotes, setConditionNotes] = React.useState("");
  /** Inline issue-dialog error (validation + duplicate serial). */
  const [issueError, setIssueError] = React.useState<string | null>(null);
  /** Id of the device being returned — its confirm shows
      `Recording…` while every other card stays usable. */
  const [returningId, setReturningId] = React.useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = React.useState("");
  const debouncedRef = React.useRef("");
  const candidateDebouncedRef = React.useRef("");

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

  // Candidate profiles for issuance: active pipeline cases, searchable.
  const [candidateDebounced, setCandidateDebounced] = React.useState("");
  React.useEffect(() => {
    if (!issueOpen) return;
    const t = setTimeout(() => {
      const next = candidateQuery.trim();
      if (next === candidateDebouncedRef.current) return;
      candidateDebouncedRef.current = next;
      setCandidateDebounced(next);
    }, 300);
    return () => clearTimeout(t);
  }, [candidateQuery, issueOpen]);

  const candidatesQuery = useQuery({
    queryKey: ["coordinator-devices", "candidates", candidateDebounced],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(1, {
        q: candidateDebounced || undefined,
        limit: 50,
        signal,
      }),
    enabled: issueOpen,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-devices"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
  };

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/api/adm/devices/issue", {
        admLearnerProfileId: profileId,
        deviceType: deviceType.trim(),
        deviceSerial: deviceSerial.trim(),
        ...(conditionNotes.trim() ? { conditionNotes: conditionNotes.trim() } : {}),
      });
      return data;
    },
    onSuccess: () => {
      invalidate();
      setIssueOpen(false);
      setProfileId("");
      setDeviceSerial("");
      setConditionNotes("");
      setIssueError(null);
      setCandidateQuery("");
      toast.success({ title: "Device issued", description: `Serial ${deviceSerial.trim()} recorded as issued.` });
    },
    onError: (err) => {
      const message = apiErrorMessage(err);
      setIssueError(message);
      toast.error({ title: "Could not issue device", description: message });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/api/adm/devices/${id}/return`, {});
      return data;
    },
    onSuccess: (_data, id) => {
      // The returned card flips immediately — patch cached ledger pages
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

  const candidates = React.useMemo(
    () => (candidatesQuery.data?.rows ?? []).filter((r) => !r.id.startsWith("referral:")),
    [candidatesQuery.data],
  );
  const selectedCandidate = candidates.find((r) => r.id === profileId) ?? null;

  const hasActiveFilters = filter !== "all" || debounced !== "";
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === filter)?.label ?? "Status";

  const clearFilters = () => {
    setFilter("all");
    setQuery("");
    setPage(1);
  };

  return (
    <section className={pageStyles.page}>
      <header className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>Learning Devices</h1>
          <p className={pageStyles.subtitle}>
            {devicesQuery.data
              ? `${devicesQuery.data.issued} issued · ${devicesQuery.data.returned} returned${deviceBackground ? " · Syncing…" : ""}`
              : "Tablet issuance and return ledger"}
          </p>
        </div>
        <Button onClick={() => setIssueOpen(true)}>
          Issue device
        </Button>
      </header>

      <div className={pageStyles.filterRow}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${pageStyles.toolbarFilterBtn} ${filter !== "all" ? pageStyles.toolbarFilterActive : ""}`}
            >
              {filter === "all" ? "Status" : statusLabel}
              {filter !== "all" && <span className={pageStyles.filterDot} aria-hidden />}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUS_OPTIONS.map((item, index) => (
              <div key={item.value}>
                {index === 1 && <DropdownMenuSeparator />}
                <DropdownMenuCheckboxItem
                  checked={filter === item.value}
                  onCheckedChange={() => {
                    setFilter(item.value);
                    setPage(1);
                  }}
                >
                  {item.label}
                </DropdownMenuCheckboxItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className={pageStyles.toolbarSearchWrap}>
          <Search className={pageStyles.toolbarSearchIcon} aria-hidden />
          <Input
            className={pageStyles.toolbarSearch}
            placeholder="Search serial, student, or LRN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search devices"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden />
            Clear
          </Button>
        )}
      </div>

      {devicesQuery.isPending ? (
        <div
          className={pageStyles.deviceGrid}
          aria-busy="true"
          aria-label="Loading devices"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={pageStyles.deviceCard} aria-hidden="true">
              <div className={pageStyles.deviceCardTop}>
                <div className={pageStyles.deviceIdentity}>
                  <Skeleton style={{ width: "2rem", height: "2rem" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Skeleton style={{ width: "4.5rem", height: "0.875rem" }} />
                    <Skeleton
                      style={{
                        width: "5.5rem",
                        height: "0.75rem",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>
                </div>
                <Skeleton
                  style={{ width: "3.5rem", height: "1.375rem", borderRadius: "999px" }}
                />
              </div>
              <div className={pageStyles.deviceMeta}>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className={pageStyles.deviceMetaRow}>
                    <Skeleton style={{ width: "3rem", height: "0.6875rem" }} />
                    <Skeleton style={{ width: "6rem", height: "0.8125rem" }} />
                  </div>
                ))}
              </div>
              <div className={pageStyles.deviceCardFoot}>
                <Skeleton style={{ width: "6.5rem", height: "1.75rem" }} />
              </div>
            </div>
          ))}
        </div>
      ) : devicesQuery.isError || !devicesQuery.data ? (
        <div className={pageStyles.errorBlock} role="alert">
          <p className={pageStyles.errorText}>
            We couldn&apos;t load the device ledger. Please check your internet connection and try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={devicesQuery.isRefetching}
            onClick={() => devicesQuery.refetch()}
          >
            {devicesQuery.isRefetching ? <Loader2 className={pageStyles.spin} aria-hidden="true" /> : null}
            {devicesQuery.isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className={pageStyles.deviceEmptyWrap}>
          <p className={pageStyles.emptyText}>
            {debounced || filter !== "all"
              ? "No devices match the current filters."
              : "No devices issued yet."}
          </p>
        </div>
      ) : (
        <div className={pageStyles.deviceGrid}>
          {rows.map((d) => (
            <article key={d.id} className={pageStyles.deviceCard} aria-label={`${d.deviceType} ${d.deviceSerial}`}>
              <div className={pageStyles.deviceCardTop}>
                <div className={pageStyles.deviceIdentity}>
                  <span className={pageStyles.deviceIcon} aria-hidden="true">
                    <TabletSmartphone />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className={pageStyles.deviceType} title={d.deviceType}>
                      {d.deviceType}
                    </p>
                    <p className={pageStyles.deviceSerial} title={d.deviceSerial}>
                      {d.deviceSerial}
                    </p>
                  </div>
                </div>
                <Badge variant={d.status === "issued" ? "secondary" : "outline"}>
                  {d.status === "issued" ? "Issued" : "Returned"}
                </Badge>
              </div>

              <div className={pageStyles.deviceMeta}>
                <div className={pageStyles.deviceMetaRow}>
                  <span className={pageStyles.deviceMetaLabel}>Student</span>
                  <span className={pageStyles.deviceMetaValue} title={`${d.student} · ${d.lrn}`}>
                    {d.student}
                  </span>
                </div>
                <div className={pageStyles.deviceMetaRow}>
                  <span className={pageStyles.deviceMetaLabel}>LRN</span>
                  <span className={`${pageStyles.deviceMetaValue} ${pageStyles.mono}`}>{d.lrn}</span>
                </div>
                <div className={pageStyles.deviceMetaRow}>
                  <span className={pageStyles.deviceMetaLabel}>Issued</span>
                  <span className={`${pageStyles.deviceMetaValue} ${pageStyles.mono}`} title={`by ${d.issuedBy}`}>
                    {d.issuedDate}
                  </span>
                </div>
                <div className={pageStyles.deviceMetaRow}>
                  <span className={pageStyles.deviceMetaLabel}>Returned</span>
                  <span className={`${pageStyles.deviceMetaValue} ${pageStyles.mono}`}>
                    {d.returnedDate ?? "—"}
                  </span>
                </div>
              </div>

              {d.conditionNotes ? (
                <p className={pageStyles.deviceNotes}>{d.conditionNotes}</p>
              ) : null}

              <div className={pageStyles.deviceCardFoot}>
                {d.status === "issued" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={returningId === d.id}
                    onClick={() => setReturnTarget(d)}
                  >
                    {returningId === d.id ? (
                      <>
                        <Loader2 className={pageStyles.spin} aria-hidden="true" />
                        Recording…
                      </>
                    ) : (
                      "Record return"
                    )}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {!devicesQuery.isPending &&
      !devicesQuery.isError &&
      devicesQuery.data &&
      rows.length > 0 ? (
        <div className={pageStyles.pagination}>
          <span>
            Showing {deviceStart}–{deviceEnd} of {deviceTotal}
            {deviceBackground ? (
              <span aria-live="polite"> · Syncing…</span>
            ) : null}
          </span>
          <div className={pageStyles.paginationBtns}>
            <Button
              size="sm"
              variant="outline"
              disabled={deviceSafePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span aria-live="polite">
              Page {deviceSafePage} of {deviceTotalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={deviceSafePage >= deviceTotalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {/* Issue dialog */}
      <Dialog
        open={issueOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIssueOpen(false);
            setIssueError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue device</DialogTitle>
            <DialogDescription>
              Records a learning device as issued to an ADM learner.
            </DialogDescription>
          </DialogHeader>
          <div className={pageStyles.formGrid}>
            <div className={pageStyles.formField}>
              <Label className={pageStyles.formLabel} htmlFor="dev-profile">
                Learner case
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="dev-profile"
                    variant="outline"
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectedCandidate
                        ? `${selectedCandidate.student} · ${selectedCandidate.lrn}`
                        : "Select a case…"}
                    </span>
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" style={{ maxWidth: "22rem" }}>
                  <div style={{ padding: "0.375rem" }}>
                    <Input
                      placeholder="Search cases…"
                      value={candidateQuery}
                      onChange={(e) => setCandidateQuery(e.target.value)}
                      aria-label="Search candidate cases"
                      style={{ height: "2rem", fontSize: "0.8125rem" }}
                    />
                  </div>
                  {candidatesQuery.isPending && candidates.length === 0 ? (
                    <DropdownMenuItem disabled>Loading cases…</DropdownMenuItem>
                  ) : candidates.length === 0 ? (
                    <DropdownMenuItem disabled>
                      {candidateDebounced
                        ? "No cases match this search."
                        : "No eligible cases"}
                    </DropdownMenuItem>
                  ) : (
                    candidates.map((r) => (
                      <DropdownMenuItem key={r.id} onSelect={() => setProfileId(r.id)}>
                        {r.student} · {r.lrn}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={pageStyles.formField}>
              <Label className={pageStyles.formLabel} htmlFor="dev-type">
                Device type
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="dev-type"
                    variant="outline"
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    {deviceType || "Select device type…"}
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {DEVICE_TYPE_OPTIONS.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => setDeviceType(t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={pageStyles.formField}>
              <Label className={pageStyles.formLabel} htmlFor="dev-serial">
                Serial number
              </Label>
              <Input
                id="dev-serial"
                value={deviceSerial}
                onChange={(e) => {
                  setDeviceSerial(e.target.value);
                  if (issueError) setIssueError(null);
                }}
                placeholder="e.g. SN48213"
                aria-invalid={issueError ? true : undefined}
              />
            </div>
            <div className={pageStyles.formField}>
              <Label className={pageStyles.formLabel} htmlFor="dev-condition">
                Condition at issuance (optional)
              </Label>
              <Input
                id="dev-condition"
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="e.g. New, with charger and case"
              />
            </div>
          </div>
          {issueError ? (
            <p role="alert" style={{ margin: "0.75rem 0 0", fontSize: "0.8125rem", color: "#dc2626" }}>
              {issueError}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <Button variant="destructive" className={pageStyles.btnRed} onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={issueMutation.isPending || !profileId || !deviceType.trim() || !deviceSerial.trim()}
              onClick={() => {
                if (!profileId || !deviceSerial.trim()) {
                  setIssueError("Select a learner case and enter the device serial number.");
                  return;
                }
                issueMutation.mutate();
              }}
            >
              {issueMutation.isPending ? <Loader2 className={pageStyles.spin} aria-hidden="true" /> : null}
              {issueMutation.isPending ? "Issuing…" : "Issue device"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return confirm */}
      <AlertDialog open={returnTarget !== null} onOpenChange={(open) => !open && setReturnTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record device return?</AlertDialogTitle>
            <AlertDialogDescription>
              {returnTarget ? (
                <>
                  {returnTarget.deviceType} ({returnTarget.deviceSerial}) issued to{" "}
                  {returnTarget.student} will be marked returned today.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={returnMutation.isPending}
              onClick={() => {
                if (returnTarget && !returnMutation.isPending) {
                  setReturningId(returnTarget.id);
                  returnMutation.mutate(returnTarget.id);
                }
              }}
            >
              {returnMutation.isPending ? <Loader2 className={pageStyles.spin} aria-hidden="true" /> : null}
              {returnMutation.isPending ? "Recording…" : "Record return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
