"use client";
import * as React from "react";
import { SearchIcon } from "lucide-react";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  AdmReferralForm,
  AdmReferralRow,
} from "@/services/principal/adm.types";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { SignReturnConfirmDialog } from "./SignReturnConfirmDialog";
import { ShieldCheck } from "lucide-react";
import { PrincipalEmptyCard } from "../../../components/PrincipalEmptyCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Pagination } from "@/components/shared/pagination";
import { useDock } from "@/components/dock/dock-store";
import { useAdmReferralsList } from "./components/use-adm-referrals-list";
import { useGcForm03Opener } from "./components/use-gc-form-03-opener";
import {
  AdmReferralsTable,
  type AdmReferralLaneFilter,
} from "./components/adm-referrals-table";
import { AdmReferralsBoard } from "./components/adm-referrals-board";
import { AdmFormsModal } from "./components/adm-forms-modal";
import { AdmPreviewModal, type AdmPreviewState } from "./components/adm-preview-modal";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useSearchParams } from "next/navigation";
import { stageLabel } from "../../adm";
import menu from "../../../risk/heatmaps/components/heatmap.module.css";
import styles from "./all.module.css";

const LANE_TABS: {
  key: AdmReferralLaneFilter;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Awaiting signature" },
  { key: "returned", label: "Returned for revision" },
  { key: "signed", label: "Signed" },
];

export default function PrincipalAdmReferralsAllPage() {
  return (
    <React.Suspense>
      <PrincipalAdmReferralsAllPageInner />
    </React.Suspense>
  );
}

function PrincipalAdmReferralsAllPageInner() {
  const queryClient = useQueryClient();
  const dock = useDock();
  const searchParams = useSearchParams();
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [laneFilter, setLaneFilter] =
    React.useState<AdmReferralLaneFilter>("all");
  const [searchInput, setSearchInput] = React.useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim(), 300);
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const { rows, setRows, totalCount, loading, isFetching, error, refetch } =
    useAdmReferralsList(search, page);

  // Keep search in the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: search || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const { gcOpen, setGcOpen, gcData, openGcForm03 } = useGcForm03Opener();
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    type: "sign" | "return";
  } | null>(null);
  const [preview, setPreview] = React.useState<AdmPreviewState | null>(null);
  const [officialFormId, setOfficialFormId] = React.useState<string | null>(null);
  const [formsFor, setFormsFor] = React.useState<AdmReferralRow | null>(null);
  const openForm = React.useCallback(
    (f: AdmReferralForm, r: AdmReferralRow) => {
      // The preview opens on top of the linked-forms sheet, which stays open
      // behind it until the user closes it themselves.
      if (f.formType === "ANECDOTAL_REPORT" && r.anecdotalRecordId) {
        setOfficialFormId(r.anecdotalRecordId);
        return;
      }
      if (f.formType === "REFERRAL_FORM" && r.anecdotalRecordId) {
        void openGcForm03(r);
        return;
      }
      setPreview({
        form: f,
        student: r.student,
        lrn: r.lrn,
        anecdotalRecordId: r.anecdotalRecordId ?? null,
      });
    },
    [openGcForm03],
  );

  // Every decision runs through the shared Dock — it reports progress and the
  // outcome, so the page never needs its own toast for sign/return.
  const handleSign = (id: string) => {
    if (actionId) return;
    const row = rows.find((r) => r.id === id);
    setActionId(id);
    const snapshot = rows;
    const dockId = dock.startTask({
      kind: "generic",
      title: "Signing ADM case",
      description: `${row?.student ?? "Endorsed case"} · ${row ? stageLabel(row.stage) : "Principal approval"}`,
    });
    return apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  approvedBy: "Principal",
                  approvalDate: new Date().toISOString().slice(0, 10),
                }
              : r,
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        dock.completeTask(
          dockId,
          `Signed — ${row?.student ?? "case"} moved to monitoring`,
        );
        return refetch();
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-approve] failed:", err);
        setRows(() => snapshot);
        dock.failTask(
          dockId,
          "Could not approve this case. Changes were rolled back.",
        );
      })
      .finally(() => setActionId(null));
  };
  const handleReturn = (id: string, reason: string) => {
    if (actionId) return;
    const row = rows.find((r) => r.id === id);
    setActionId(id);
    const dockId = dock.startTask({
      kind: "generic",
      title: "Returning ADM case",
      description: `${row?.student ?? "Endorsed case"} · back to the ADM Coordinator`,
    });
    return apiClient
      .post(`/api/adm/${id}/principal-return`, { reason })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        dock.completeTask(
          dockId,
          `Returned — ${row?.student ?? "case"} sent back for revision`,
        );
        return refetch();
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-return] failed:", err);
        dock.failTask(dockId, "Could not return this case. Please try again.");
      })
      .finally(() => setActionId(null));
  };
  const pendingRow =
    pendingAction && rows.find((r) => r.id === pendingAction.id);
  const isEmpty = !loading && !error && totalCount === 0 && search.trim() === "";
  return (
    <div className={menu.shell}>
      <div className={menu.layout}>
        <section
          aria-label="ADM cases"
          className={styles.page}
          aria-busy={loading || undefined}
        >
          {isEmpty ? (
            <PrincipalEmptyCard
              icon={ShieldCheck}
              title="No referrals found"
              hint="Endorsed cases will appear here once filed."
              label="Endorsed ADM Cases"
              centered
            />
          ) : (
            <KanbanBoard
              title="Endorsed ADM Cases"
              icon={<ShieldCheck size={14} aria-hidden="true" />}
              description={
                totalCount === 0
                  ? "No ADM referrals on record."
                  : `${totalCount} case${totalCount === 1 ? "" : "s"} endorsed by the ADM Coordinator — signed cases stay on this list and are final.`
              }
              headerCenter={
                <div
                  className={styles.filterTabs}
                  role="tablist"
                  aria-label="Filter by approval state"
                >
                  {LANE_TABS.map((tab) => {
                    const active = laneFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setLaneFilter(tab.key)}
                        className={styles.filterTab}
                      >
                        <Pill
                          tone={active ? "blue" : "neutral"}
                          className="h-6 px-2.5"
                        >
                          {tab.label}
                        </Pill>
                      </button>
                    );
                  })}
                </div>
              }
              actions={
                <InputGroup className="max-w-40 shrink-0 rounded-[2rem]">
                  <InputGroupInput
                    placeholder="Search name, LRN, or ID…"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                    }}
                    aria-label="Search referrals"
                  />
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                </InputGroup>
              }
              footer={
                <Pagination
                  currentPage={page}
                  totalItems={totalCount}
                  onPageChange={setPage}
                />
              }
            >
              {laneFilter === "all" ? (
                <AdmReferralsTable
                  rows={rows}
                  totalCount={totalCount}
                  loading={loading}
                  isFetching={isFetching}
                  error={error}
                  search={search}
                  laneFilter={laneFilter}
                  actionId={actionId}
                  onRequestSign={(id) => setPendingAction({ id, type: "sign" })}
                  onRequestReturn={(id) =>
                    setPendingAction({ id, type: "return" })
                  }
                  onViewForms={(r) => setFormsFor(r)}
                  onRetry={() => void refetch()}
                />
              ) : (
                <AdmReferralsBoard
                  rows={rows}
                  loading={loading}
                  isFetching={isFetching}
                  error={error}
                  search={search}
                  laneFilter={laneFilter}
                  actionId={actionId}
                  onRequestSign={(id) => setPendingAction({ id, type: "sign" })}
                  onRequestReturn={(id) =>
                    setPendingAction({ id, type: "return" })
                  }
                  onViewForms={(r) => setFormsFor(r)}
                  onRetry={() => void refetch()}
                />
              )}
            </KanbanBoard>
          )}
          <AdmPreviewModal
            preview={preview}
            onClose={() => setPreview(null)}
            onOpenOfficial={(id) => setOfficialFormId(id)}
          />
          <AdmFormsModal
            formsFor={formsFor}
            onClose={() => setFormsFor(null)}
            onOpenForm={openForm}
            dismissable={preview === null && officialFormId === null && !gcOpen}
          />
          <OcForm01PreviewDialog
            recordId={officialFormId}
            onClose={() => setOfficialFormId(null)}
          />
          <GcForm03PreviewDialog
            open={gcOpen}
            data={gcData}
            confirming={false}
            onClose={() => {
              setGcOpen(false);
            }}
            onConfirm={() => setGcOpen(false)}
            viewOnly
          />
          <SignReturnConfirmDialog
            pendingAction={pendingAction}
            busyActionId={actionId}
            pendingRow={pendingRow}
            onClose={() => setPendingAction(null)}
            onConfirm={(target) => {
              setPendingAction(null);
              if (target.type === "sign") void handleSign(target.id);
              else void handleReturn(target.id, target.reason ?? "");
            }}
          />
        </section>
      </div>
    </div>
  );
}
