"use client";

import * as React from "react";
import {
  Search,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import { stageLabel, isAwaitingSignature, canReturn } from "../../../adm/adm";
import dialog from "../../../adm/components/admDialog.module.css";
import styles from "./all.module.css";
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

export default function PrincipalAdmReferralsAllPage() {
  const [rows, setRows] = React.useState<AdmReferralRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalReferred, setTotalReferred] = React.useState(0);
  const [stageCounts, setStageCounts] = React.useState<Record<string, number>>({});
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
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);

  // Form icons open their own official sheet: anecdotal → GCForm-01,
  // referral → filled GCForm-03 rebuilt from the case + its GCForm-01.
  // Anything else falls back to the metadata overlay.
  async function openGcForm03(r: AdmReferralRow) {
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
  }

  function openForm(f: AdmReferralForm, r: AdmReferralRow) {
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
  }

  React.useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

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
          setTotalReferred(
            typeof data.totalReferred === "number"
              ? data.totalReferred
              : data.rows.length
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

  const pageRows = rows;
  const totalCount = total;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, totalCount);

  const handleSign = (id: string) =>
    apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => load(page))
      .catch((err: unknown) =>
        console.error("[/api/adm principal-approve] failed:", err)
      );

  const handleReturn = (id: string) =>
    apiClient
      .post(`/api/adm/${id}/principal-return`)
      .then(() => load(page))
      .catch((err: unknown) =>
        console.error("[/api/adm principal-return] failed:", err)
      );

  const pendingRow =
    pendingAction && rows.find((r) => r.id === pendingAction.id);

  const asCase = (r: AdmReferralRow) => ({
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
  });

  return (
    <section aria-label="ADM cases" className={styles.feed}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Endorsed ADM Cases</h2>
          <p className={styles.sectionDesc} aria-live="polite">
            {totalCount === 0
              ? "No ADM referrals on record."
              : `${totalCount} case${totalCount === 1 ? "" : "s"} endorsed by the ADM Coordinator — signed cases stay on this list.`}
          </p>
        </div>
        <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                placeholder="Search name, LRN, or ID…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search referrals"
              />
            </div>
        </div>
      </div>

      <div className={styles.tableBody}>
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <p className={styles.empty} role="alert">
            {error}
          </p>
        ) : totalCount === 0 ? (
          <p className={styles.empty}>
            {search.trim()
              ? `No referrals match "${search}".`
              : "No referrals found."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
          <Table aria-label="ADM referral cases">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Forms</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>
                  <span className={styles.srOnly}>Row actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => {
                  const c = asCase(r);
                  const awaiting = isAwaitingSignature(c);
                  const returnable = canReturn(c);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>{r.student}</span>
                          <span className={styles.studentLrn}>{r.lrn}</span>
                        </div>
                      </TableCell>
                      <TableCell className={styles.muted}>{r.grade}</TableCell>
                      <TableCell className={styles.muted}>{r.section || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={styles.stageBadge}>
                          {stageLabel(r.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.eligibilityStatus === "eligible"
                              ? "secondary"
                              : r.eligibilityStatus === "ineligible"
                                ? "destructive"
                                : "outline"
                          }
                          className={styles.eligBadge}
                        >
                          {r.eligibilityStatus === "eligible"
                            ? "Eligible"
                            : r.eligibilityStatus === "ineligible"
                              ? "Ineligible"
                              : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {awaiting ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              setPendingAction({ id: r.id, type: "sign" })
                            }
                          >
                            Sign &amp; approve
                          </Button>
                        ) : r.approvedBy ? (
                          <Badge variant="secondary" className={styles.stageBadge}>
                            Signed
                          </Badge>
                        ) : (
                          <span className={styles.approvalPending}>Awaiting signature</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={styles.forms}>
                          {r.forms && r.forms.length > 0 ? (
                            r.forms.map((f, i) => (
                              <button
                                key={f.id}
                                type="button"
                                className={styles.formBtn}
                                onClick={() => openForm(f, r)}
                                aria-label={`Open ${f.title} report`}
                              >
                                <FormIcon
                                  formType={f.formType}
                                  title={f.title}
                                  status={f.status}
                                  index={i}
                                />
                              </button>
                            ))
                          ) : (
                            <span className={styles.noForms}>No forms</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={styles.mono}>
                        {awaiting
                          ? "ready to sign"
                          : r.approvalDate ?? r.datePrepared}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={styles.rowMenu}>
                            <DropdownMenuItem
                              disabled={!returnable}
                              className="whitespace-nowrap"
                              onClick={() => {
                                if (returnable) setPendingAction({ id: r.id, type: "return" });
                              }}
                            >
                              Return for revision
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            {totalCount > 0 ? `${start}–${end} of ${totalCount}` : "0 of 0"}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              variant="outline"
              size="xs"
              disabled={safePage <= 1 || totalCount === 0}
              onClick={() => load(safePage - 1)}
            >
              Previous
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              {`Page ${safePage} of ${totalPages}`}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={safePage >= totalPages || totalCount === 0}
              onClick={() => load(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {preview ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.form.title} report`}
          onClick={() => setPreview(null)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalHeadText}>
                <h2 className={styles.modalTitle}>{preview.form.title}</h2>
                <p className={styles.modalSub}>
                  {preview.student} · {preview.lrn}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setPreview(null)}
                aria-label="Close"
              >
                <X className={styles.modalCloseIcon} aria-hidden />
              </button>
            </div>
            <div className={styles.modalBody}>
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
          </div>
        </div>
      ) : null}

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

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent size="default" className={dialog.dialogWide}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "sign"
                ? "Sign & approve this case?"
                : "Return this case for revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "sign"
                ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
                : "The case will be sent back to the ADM Coordinator at the eligibility stage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingAction?.type === "sign"
                  ? dialog.alertSign
                  : dialog.alertReturn
              }
              onClick={() => {
                if (!pendingAction) return;
                if (pendingAction.type === "sign") handleSign(pendingAction.id);
                else handleReturn(pendingAction.id);
                setPendingAction(null);
              }}
            >
              {pendingAction?.type === "sign" ? "Sign & Approve" : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className={styles.tableWrap}>
      <Table aria-label="Loading referral cases">
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Eligibility</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Forms</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>
              <span className={styles.srOnly}>Row actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className={styles.studentCell}>
                  <Skeleton className={styles.skelName} />
                  <Skeleton className={styles.skelLrn} />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "50%" }} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "70%" }} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "55%" }} />
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "60%" }} />
              </TableCell>
              <TableCell>
                <span className={styles.forms}>
                  <Skeleton className={styles.skelChip} />
                  <Skeleton className={styles.skelChip} />
                </span>
              </TableCell>
              <TableCell>
                <Skeleton className={styles.skelCell} style={{ width: "70%" }} />
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}