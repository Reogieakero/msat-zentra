"use client";

import * as React from "react";
import Link from "next/link";
import { AdmBrowser, CaseTable } from "../../AdmBoard";
import { type AdmCase } from "../../adm";
import { apiClient } from "@/lib/api/client";
import { useMinLoading } from "../../useMinLoading";
import {
  fetchAdmReferrals,
  type AdmReferralRow,
} from "../../api";
import { DOC_LEGEND } from "../../components/DocumentCard";
import { FormIcon } from "../../components/FormIcon";
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
import shared from "../../../academics/academics.module.css";
import styles from "./all.module.css";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import header from "../../components/admHeader.module.css";
import dialog from "../../components/admDialog.module.css";
import legend from "../../components/admLegend.module.css";
import menu from "../../components/admCardMenu.module.css";

const PAGE_SIZE = 20;

const REFERRAL_STAGES = [
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
] as const;

const STAGE_TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "meeting_parents", label: "Meeting with Parents/Guardians" },
  { id: "home_visitation", label: "Home Visitation" },
  { id: "certification", label: "Recommendation & Certification" },
  { id: "principal_approval", label: "School Head (Principal) Approval" },
];

function pageItems(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

function toAdmCase(r: AdmReferralRow): AdmCase {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    section: "",
    stage: r.stage,
    eligibilityStatus: r.eligibilityStatus,
    meetingAttended: false,
    modulesSubmitted: 0,
    modulesTotal: 0,
    deviceIssued: false,
    preparedBy: r.preparedBy,
    datePrepared: r.datePrepared,
    approvedBy: r.approvedBy,
    approvalDate: r.approvalDate,
    forms: r.forms,
  };
}

function useReferralsAllBoard() {
  const [cases, setCases] = React.useState<AdmCase[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalReferred, setTotalReferred] = React.useState(0);
  const [stageCounts, setStageCounts] = React.useState<Record<string, number>>({});
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [stage, setStage] = React.useState<string>("all");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("adm_referrals_stage");
    if (saved) requestAnimationFrame(() => setStage(saved));
  }, []);

  const firstStageWrite = React.useRef(true);
  React.useEffect(() => {
    if (firstStageWrite.current) {
      firstStageWrite.current = false;
      return;
    }
    window.localStorage.setItem("adm_referrals_stage", stage);
  }, [stage]);
  const [loading, setLoading] = useMinLoading(600);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    type: "sign" | "return";
  } | null>(null);

  const load = React.useCallback(
    (p: number, signal?: AbortSignal) => {
      setLoading(true);
      return fetchAdmReferrals(
        p,
        PAGE_SIZE,
        signal,
        search.trim(),
        stage === "all" ? "" : stage
      )
        .then((data) => {
          if (!data) return;
          setError(null);
          const rows = Array.isArray(data.rows) ? data.rows : [];
          setCases(rows.map(toAdmCase));
          setTotal(typeof data.total === "number" ? data.total : rows.length);
          setTotalReferred(
            typeof data.totalReferred === "number" ? data.totalReferred : rows.length
          );
          setStageCounts(
            data.stageCounts && typeof data.stageCounts === "object"
              ? data.stageCounts
              : {}
          );
          setPage(typeof data.page === "number" ? data.page : p);
        })
        .catch((err: unknown) => {
          if ((err as { code?: string })?.code === "ERR_CANCELED") return;
          setError("Failed to load referrals");
          console.error("[/api/adm/referrals] fetch failed:", err);
        })
        .finally(() => setLoading(false));
    },
    [search, stage]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(1, controller.signal), 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [load]);

  const allReferred = React.useMemo(
    () =>
      [...cases]
        .filter((c) => (REFERRAL_STAGES as readonly string[]).includes(c.stage))
        .sort((a, b) => b.datePrepared.localeCompare(a.datePrepared)),
    [cases]
  );

  const handleSign = (id: string) =>
    apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => load(page))
      .catch((err: unknown) =>
        console.error("[/api/adm principal-approve] failed:", err)
      )
      .finally(() => setSelectedId(null));

  const handleReturn = (id: string) =>
    apiClient
      .post(`/api/adm/${id}/principal-return`)
      .then(() => load(page))
      .catch((err: unknown) =>
        console.error("[/api/adm principal-return] failed:", err)
      )
      .finally(() => setSelectedId(null));

  const confirmPending = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "sign") handleSign(pendingAction.id);
    else handleReturn(pendingAction.id);
    setPendingAction(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (p: number) => load(p);

  return {
    cases,
    loading,
    error,
    allReferred,
    total,
    totalReferred,
    stageCounts,
    page,
    totalPages,
    goToPage,
    search,
    setSearch,
    stage,
    setStage,
    selectedId,
    setSelectedId,
    pendingAction,
    setPendingAction,
    confirmPending,
    reload: () => load(page),
  };
}

export function ReferralsAllBoard() {
  const board = useReferralsAllBoard();

  const stageTabs = React.useMemo(() => {
    return STAGE_TABS.map((t) => ({
      ...t,
      count:
        t.id === "all"
          ? board.totalReferred
          : board.stageCounts[t.id] ?? 0,
    }));
  }, [board.totalReferred, board.stageCounts]);

  return (
    <section className={styles.page}>
      <div className={header.headerRow}>
        <div className={`${header.headerText} ${styles.headerText}`}>
          <h1 className={header.headerTitle}>ADM Referrals</h1>
          <p className={header.headerSub}>
            Every learner referral in the ADM pipeline — status-only, full list.
          </p>
        </div>
        <div className={header.headerActions}>
          <div className={menu.menuCard}>
            <div className={menu.menuHead}>
              <span className={menu.menuTitle}>Document Legend</span>
            </div>
            <div className={legend.docLegend}>
              {DOC_LEGEND.map((item) => (
                <span key={item.label} className={legend.docLegendItem}>
                  <span
                    className={legend.docLegendSwatch}
                    style={{ background: item.color }}
                  />
                  <span className={legend.docLegendLabel}>{item.label}</span>
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/principal/adm"
            className={header.seeAllBtn}
          >
            Back to board
          </Link>
        </div>
      </div>

      <AdmBrowser
        tabs={stageTabs}
        activeTab={board.stage}
        onTabChange={(id) => board.setStage(id)}
        action={
          <input
            type="search"
            value={board.search}
            placeholder="Search name, LRN, or ID"
            onChange={(e) => board.setSearch(e.target.value)}
            className={header.searchInput}
            aria-label="Search referrals"
          />
        }
      >
        {board.error ? (
          <p className={shared.empty}>{board.error}</p>
        ) : (
          <CaseTable
            rows={board.allReferred}
            loading={board.loading}
            emptyLabel="No referrals yet."
            onSelect={board.setSelectedId}
            onRequestAction={(id, type) => board.setPendingAction({ id, type })}
          />
        )}
      </AdmBrowser>

      {!board.loading && !board.error && board.total > 0 ? (
        <Pagination className={styles.pager}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => board.goToPage(board.page - 1)}
                aria-disabled={board.page <= 1}
                className={board.page <= 1 ? styles.pageDisabled : undefined}
              />
            </PaginationItem>
            {pageItems(board.page, board.totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`e${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === board.page}
                    onClick={() => board.goToPage(p as number)}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => board.goToPage(board.page + 1)}
                aria-disabled={board.page >= board.totalPages}
                className={board.page >= board.totalPages ? styles.pageDisabled : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      <AlertDialog
        open={board.pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) board.setPendingAction(null);
        }}
      >
        <AlertDialogContent size="default" className={dialog.dialogWide}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {board.pendingAction?.type === "sign"
                ? "Sign & approve this case?"
                : "Return this case for revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {board.pendingAction?.type === "sign"
                ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
                : "The case will be sent back to the ADM Coordinator at the eligibility stage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const pendingCase =
              board.pendingAction &&
              board.cases.find((c) => c.id === board.pendingAction!.id);
            if (!pendingCase) return null;
            return (
              <div className={dialog.dialogDocs}>
                <span className={dialog.dialogDocsName}>
                  {pendingCase.student}{" "}
                  <span className={shared.mono}>({pendingCase.lrn})</span>
                </span>
                  <div className={dialog.dialogDocsRow}>
                    {(pendingCase.forms ?? []).map((f, i) => (
                      <FormIcon
                        key={f.id}
                        formType={f.formType}
                        title={f.title}
                        status={f.status}
                        index={i}
                      />
                    ))}
                  </div>
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                board.pendingAction?.type === "sign"
                  ? dialog.alertSign
                  : dialog.alertReturn
              }
              onClick={board.confirmPending}
            >
              {board.pendingAction?.type === "sign" ? "Sign & Approve" : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function PrincipalAdmReferralsAllPage() {
  return <ReferralsAllBoard />;
}
