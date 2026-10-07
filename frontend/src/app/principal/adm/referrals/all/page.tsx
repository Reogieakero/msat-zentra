"use client";

import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  SearchIcon,
  ShieldCheck,
  Check,
  ArrowLeftRight,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CardModal } from "@/components/ui/CardModal";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  fetchAdmReferrals,
  type AdmReferralForm,
  type AdmReferralRow,
} from "../../../adm/api";
import { FormIcon } from "../../../adm/components/FormIcon";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import {
  buildGcForm03Data,
  type GcForm03Data,
} from "@/app/guidance/adm/components/gcform03-data";
import {
  fetchOcForm01Detail,
  type OcForm01Detail,
} from "@/components/ocform01/ocform01";
import { useMinLoading } from "../../../adm/useMinLoading";
import { PrincipalPageHeader } from "../../../components/PrincipalPageHeader";
import {
  stageLabel,
  isAwaitingSignature,
  canReturn,
  type AdmCase,
} from "../../../adm/adm";
import dialog from "../../../adm/components/admDialog.module.css";
import styles from "./all.module.css";
import assign from "../../../academics/assign/components/section-assignments.module.css";
import formStyles from "../../../academics/assign/components/form.module.css";

const PAGE_SIZE = 20;

const FORM_TYPE_LABELS: Record<string, string> = {
  REFERRAL_FORM: "Referral",
  ANECDOTAL_REPORT: "Anecdotal",
  CERTIFICATION: "Certification",
  MINUTES_OF_MEETING: "Minutes",
  HV_FORM: "Home Visit",
};

function fileHref(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/${fileUrl.replace(/^\//, "")}`;
}

const isImageFile = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url);
const isPdfFile = (url: string) => /\.pdf(\?|#|$)/i.test(url);

// Minimal AdmCase view for the signature/return gates (the list rows carry
// no meeting/module state — defaults stand in, as before).
function asCase(r: AdmReferralRow): AdmCase {
  return {
    id: r.id,
    student: r.student,
    lrn: r.lrn,
    grade: r.grade,
    section: r.section ?? "",
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

// Stage badges progress toward the user's primary: early stages tinted by
// phase, principal_approval solid primary (your action), post-approval green.
const STAGE_BADGE: Record<string, "outline" | "blue" | "amber" | "green" | "default" | "secondary"> = {
  anecdotal: "outline",
  consultation: "blue",
  meeting_parents: "amber",
  home_visitation: "green",
  certification: "blue",
  principal_approval: "default",
  enrollment_monitoring: "green",
  completion: "secondary",
};

function eligibilityBadge(status: AdmReferralRow["eligibilityStatus"]) {
  if (status === "eligible") return <Badge variant="secondary">Eligible</Badge>;
  if (status === "ineligible") return <Badge variant="destructive">Ineligible</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

/* Endorsed ADM cases as a data table in the At-Risk Advisees pattern:
   glow-card shell, title + count, search on the right, fixed-width
   sortable columns, icon action buttons, bordered table, pager footer.
   Signed cases are final — return for revision is only offered before
   signing. Form previews open in the shared CardModal UI. */
export default function PrincipalAdmReferralsAllPage() {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<AdmReferralRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [search, setSearch] = React.useState("");
  // Fixed view: cases the ADM Coordinator endorsed upward — awaiting
  // principal review at the School Head Approval stage.
  const [stage] = React.useState<string>("principal_approval");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = useMinLoading(600);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<
    { id: string; type: "sign" | "return" } | null
  >(null);
  const [preview, setPreview] = React.useState<{
    form: AdmReferralForm;
    student: string;
    lrn: string;
    anecdotalRecordId: string | null;
  } | null>(null);
  const [officialFormId, setOfficialFormId] = React.useState<string | null>(null);
  // Row whose linked forms are shown as folders in a card modal.
  const [formsFor, setFormsFor] = React.useState<AdmReferralRow | null>(null);
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Form icons open their own official sheet: anecdotal → GCForm-01,
  // referral → filled GCForm-03 rebuilt from the case + its GCForm-01.
  // Anything else falls back to the metadata preview.
  const openGcForm03 = React.useCallback(
    async (r: AdmReferralRow) => {
      if (gcLoading || !r.anecdotalRecordId) return;
      setGcLoading(true);
      try {
        let report: OcForm01Detail | null = null;
        try {
          report = await fetchOcForm01Detail(r.anecdotalRecordId);
        } catch {
          report = null;
        }
        const data = buildGcForm03Data(
          {
            student: r.student,
            grade: r.grade,
            section: r.section,
            reason: "",
            referredBy: r.preparedBy,
            date: r.datePrepared,
          },
          report,
          ""
        );
        setGcData(data);
        setGcOpen(true);
      } finally {
        setGcLoading(false);
      }
    },
    [gcLoading]
  );

  const openForm = React.useCallback(
    (f: AdmReferralForm, r: AdmReferralRow) => {
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
    [openGcForm03]
  );

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
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setTotal(typeof data.total === "number" ? data.total : data.rows.length);
          setPage(typeof data.page === "number" ? data.page : p);
        })
        .catch((err: unknown) => {
          if ((err as { code?: string })?.code === "ERR_CANCELED") return;
          setError("Failed to load referrals");
          console.error("[/api/adm/referrals] fetch failed:", err);
        })
        .finally(() => setLoading(false));
    },
    [search, stage, setLoading]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(1, controller.signal), 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [load]);

  const totalCount = total;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, totalCount);

  // Action-level states: per-row spinner, disabled double-submit, toast
  // only after server confirmation, targeted refresh (no full-page reload).
  const handleSign = (id: string) => {
    if (actionId) return;
    setActionId(id);
    return apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, approvedBy: "Principal", approvalDate: new Date().toISOString().slice(0, 10) } : r,
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        toast.success({ title: "Signed — moved to monitoring" });
        return load(page);
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-approve] failed:", err);
        toast.error({ title: "Sign failed", description: "Could not approve this case." });
      })
      .finally(() => setActionId(null));
  };

  const handleReturn = (id: string) => {
    if (actionId) return;
    setActionId(id);
    return apiClient
      .post(`/api/adm/${id}/principal-return`)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        toast.success({ title: "Returned to ADM Coordinator" });
        return load(page);
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-return] failed:", err);
        toast.error({ title: "Return failed", description: "Could not return this case." });
      })
      .finally(() => setActionId(null));
  };

  const pendingRow =
    pendingAction && rows.find((r) => r.id === pendingAction.id);

  const columns = React.useMemo<ColumnDef<AdmReferralRow>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.student,
        header: "Student",
        size: 220,
        minSize: 220,
        maxSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={styles.cellMain}>{row.original.student}</p>
            <p className={styles.cellSub}>
              {row.original.lrn}
              {row.original.section ? ` · ${row.original.section}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "grade",
        accessorFn: (row) => row.grade,
        header: "Grade",
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => <span className={styles.muted}>{row.original.grade}</span>,
      },
      {
        id: "stage",
        accessorFn: (row) => stageLabel(row.stage),
        header: "Stage",
        size: 170,
        minSize: 170,
        maxSize: 170,
        cell: ({ row }) => (
          <Badge
            variant={STAGE_BADGE[row.original.stage] ?? "outline"}
            className={styles.stageBadge}
          >
            {stageLabel(row.original.stage)}
          </Badge>
        ),
      },
      {
        id: "eligibility",
        accessorFn: (row) => row.eligibilityStatus,
        header: "Eligibility",
        size: 130,
        minSize: 130,
        maxSize: 130,
        cell: ({ row }) => eligibilityBadge(row.original.eligibilityStatus),
      },
      {
        id: "approval",
        accessorFn: (row) =>
          isAwaitingSignature(asCase(row))
            ? "0-awaiting"
            : row.approvedBy
              ? "2-signed"
              : "1-pending",
        header: "Approval",
        size: 180,
        minSize: 180,
        maxSize: 180,
        cell: ({ row }) => {
          const r = row.original;
          const awaiting = isAwaitingSignature(asCase(r));
          if (awaiting) {
            return (
              <span className={styles.actionBtns}>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Sign and approve case for ${r.student}`}
                  title="Sign & approve"
                  disabled={actionId !== null}
                  aria-busy={actionId === r.id}
                  onClick={() => setPendingAction({ id: r.id, type: "sign" })}
                >
                  {actionId === r.id ? <Spinner aria-hidden /> : <Check aria-hidden />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Return case for ${r.student} for revision`}
                  title="Return for revision"
                  disabled={actionId !== null}
                  onClick={() => setPendingAction({ id: r.id, type: "return" })}
                >
                  <ArrowLeftRight aria-hidden />
                </Button>
              </span>
            );
          }
          if (r.approvedBy) {
            return (
              <Badge variant="secondary" className={styles.stageBadge}>
                Signed
              </Badge>
            );
          }
          return (
            <span className={styles.actionBtns}>
              <span className={styles.approvalPending}>Awaiting signature</span>
              {canReturn(asCase(r)) ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Return case for ${r.student} for revision`}
                  title="Return for revision"
                  onClick={() => setPendingAction({ id: r.id, type: "return" })}
                >
                  <ArrowLeftRight aria-hidden />
                </Button>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "forms",
        accessorFn: (row) => row.forms?.length ?? 0,
        header: "Forms",
        size: 140,
        minSize: 140,
        maxSize: 140,
        cell: ({ row }) => {
          const r = row.original;
          const count = r.forms?.length ?? 0;
          if (count === 0) return <span className={styles.noForms}>No forms</span>;
          return (
            <Button
              variant="outline"
              size="sm"
              className={styles.formsBtn}
              aria-label={`View ${count} linked form${count === 1 ? "" : "s"} for ${r.student}`}
              title={`${count} linked form${count === 1 ? "" : "s"}`}
              onClick={() => setFormsFor(r)}
            >
              <FolderOpen aria-hidden />
              {count}
            </Button>
          );
        },
      },
      {
        id: "date",
        accessorFn: (row) => row.approvalDate ?? row.datePrepared,
        header: "Date",
        size: 120,
        minSize: 120,
        maxSize: 120,
        cell: ({ row }) => (
          <span className={styles.mono}>
            {row.original.approvalDate ?? row.original.datePrepared}
          </span>
        ),
      },
    ],
    [actionId]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  return (
    <section aria-label="ADM cases" className="flex min-w-0 flex-col gap-3">
      <PrincipalPageHeader
        title="ADM Referrals"
        description="Cases the ADM Coordinator endorsed upward — review, sign, or return for revision."
      />
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>Endorsed ADM Cases</h2>
            <p className={styles.sectionDesc} aria-live="polite">
              {totalCount === 0
                ? "No ADM referrals on record."
                : `${totalCount} case${totalCount === 1 ? "" : "s"} endorsed by the ADM Coordinator — signed cases stay on this list and are final.`}
            </p>
          </div>
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Search name, LRN, or ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search referrals"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>

        {loading ? (
          <div className="relative overflow-x-auto rounded-md border">
            <Table className="w-full table-fixed" aria-label="Loading referral cases">
              <TableHeader>
                <TableRow className="bg-muted/50 [&>th]:border-t-0">
                  {["Student", "Grade", "Stage", "Eligibility", "Approval", "Forms", "Date"].map(
                    (h) => (
                      <TableHead key={h} className="h-10 whitespace-nowrap">
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className={styles.skelName} />
                      <Skeleton className={styles.skelLrn} />
                    </TableCell>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className={styles.skelCell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <p className={styles.empty} role="alert">
            {error}
          </p>
        ) : totalCount === 0 ? (
          <div className="relative flex flex-col items-center gap-2 py-6 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden="true"
            >
              <ShieldCheck size={24} className="text-muted-foreground" />
            </span>
            <p className="font-medium">No referrals found</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search.trim()
                ? `No referrals match "${search}".`
                : "Endorsed cases will appear here once filed."}
            </p>
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto rounded-md border">
              <Table className="w-full table-fixed" aria-label="ADM referral cases">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{ width: header.getSize() }}
                          onClick={header.column.getToggleSortingHandler()}
                          className="h-10 cursor-pointer truncate whitespace-nowrap select-none"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className="truncate"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No referrals match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="relative flex items-center justify-end space-x-2">
              <div className="text-muted-foreground flex-1 text-sm">
                {totalCount > 0 ? `${start}–${end} of ${totalCount}` : "0 of 0"}
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1 || totalCount === 0}
                  onClick={() => load(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages || totalCount === 0}
                  onClick={() => load(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <CardModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.form.title ?? "Report"}
        description={
          preview ? `${preview.student} · ${preview.lrn}` : undefined
        }
        watchKey={preview?.form.id}
      >
        {preview ? (
          <div className={styles.previewBody}>
            <dl className={styles.previewMeta}>
              <div className={styles.previewRow}>
                <dt>Type</dt>
                <dd>{FORM_TYPE_LABELS[preview.form.formType] ?? preview.form.title}</dd>
              </div>
              <div className={styles.previewRow}>
                <dt>Status</dt>
                <dd>
                  <Badge variant="outline">{preview.form.status}</Badge>
                </dd>
              </div>
              <div className={styles.previewRow}>
                <dt>Uploaded</dt>
                <dd>{preview.form.uploadedAt ? preview.form.uploadedAt.slice(0, 10) : "—"}</dd>
              </div>
              <div className={styles.previewRow}>
                <dt>Notes</dt>
                <dd>{preview.form.notes?.trim() ? preview.form.notes : "No notes on file."}</dd>
              </div>
            </dl>
            {preview.anecdotalRecordId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOfficialFormId(preview.anecdotalRecordId)}
              >
                Open official anecdotal form
              </Button>
            ) : null}
            {preview.form.fileUrl ? (
              isImageFile(preview.form.fileUrl) ? (
                <img
                  src={fileHref(preview.form.fileUrl)}
                  alt={`${preview.form.title} attachment`}
                  className={styles.previewImg}
                />
              ) : isPdfFile(preview.form.fileUrl) ? (
                <iframe
                  src={fileHref(preview.form.fileUrl)}
                  title={`${preview.form.title} attachment`}
                  className={styles.previewDoc}
                />
              ) : (
                <a
                  href={fileHref(preview.form.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.previewLink}
                >
                  Open attached file
                </a>
              )
            ) : (
              <p className={styles.previewEmpty}>No file attached to this report.</p>
            )}
          </div>
        ) : null}
      </CardModal>

      <CardModal
        open={formsFor !== null}
        onClose={() => setFormsFor(null)}
        title={formsFor ? `Linked forms — ${formsFor.student}` : "Linked forms"}
        description={
          formsFor
            ? `${formsFor.lrn}${formsFor.section ? ` · ${formsFor.section}` : ""} · ${formsFor.forms?.length ?? 0} form${(formsFor.forms?.length ?? 0) === 1 ? "" : "s"} linked to this endorsement`
            : undefined
        }
        size="lg"
        watchKey={formsFor?.id}
      >
        {formsFor && formsFor.forms && formsFor.forms.length > 0 ? (
          <div className={styles.folderGrid}>
            {formsFor.forms.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.folderBtn}
                onClick={() => {
                  const row = formsFor;
                  setFormsFor(null);
                  openForm(f, row);
                }}
                aria-label={`Open ${f.title} report`}
              >
                <FolderCard
                  label={f.title}
                  sublabel={`${FORM_TYPE_LABELS[f.formType] ?? f.formType} · ${f.status}`}
                  cornerTag={FORM_TYPE_LABELS[f.formType] ?? f.formType}
                  folderColor="var(--primary)"
                  files={[
                    {
                      name: f.uploadedAt ? f.uploadedAt.slice(0, 10) : f.title,
                      tag: f.status,
                      icon: "doc" as const,
                    },
                  ]}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.previewEmpty}>No forms linked to this endorsement.</p>
        )}
      </CardModal>

      <OcForm01PreviewDialog
        recordId={officialFormId}
        onClose={() => setOfficialFormId(null)}
      />

      <GcForm03PreviewDialog
        open={gcOpen}
        data={gcData}
        confirming={false}
        onClose={() => setGcOpen(false)}
        onConfirm={() => setGcOpen(false)}
        viewOnly
      />

      <CardModal
        open={pendingAction !== null}
        onClose={() => {
          if (actionId) return;
          setPendingAction(null);
        }}
        size="sm"
        title={
          pendingAction?.type === "sign"
            ? "Sign & approve this case?"
            : "Return this case for revision?"
        }
        description={
          pendingAction?.type === "sign"
            ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
            : "The case will be sent back to the ADM Coordinator at the eligibility stage."
        }
        dismissable={actionId === null}
        watchKey={pendingAction?.id}
      >
        {pendingRow ? (
          <div className={dialog.dialogDocs}>
            <span className={dialog.dialogDocsName}>
              {pendingRow.student}{" "}
              <span className={styles.mono}>({pendingRow.lrn})</span>
            </span>
            <div className={dialog.dialogDocsRow}>
              {(pendingRow.forms ?? []).map((f, i) => (
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
        ) : null}
        <div className={formStyles.dialogFooter}>
          <Button
            variant="outline"
            onClick={() => setPendingAction(null)}
            disabled={actionId !== null}
          >
            Cancel
          </Button>
          <Button
            variant={pendingAction?.type === "sign" ? "default" : "destructive"}
            disabled={actionId !== null}
            aria-busy={actionId !== null}
            onClick={() => {
              if (!pendingAction || actionId) return;
              const target = pendingAction;
              setPendingAction(null);
              if (target.type === "sign") void handleSign(target.id);
              else void handleReturn(target.id);
            }}
          >
            {actionId !== null ? (
              <>
                <Spinner className="size-4" aria-hidden />
                {pendingAction?.type === "sign" ? "Signing…" : "Returning…"}
              </>
            ) : pendingAction?.type === "sign" ? (
              "Sign & Approve"
            ) : (
              "Confirm Return"
            )}
          </Button>
        </div>
      </CardModal>
    </section>
  );
}
