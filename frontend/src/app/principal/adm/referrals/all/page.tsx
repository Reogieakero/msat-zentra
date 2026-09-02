"use client";

import * as React from "react";
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
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
  type AdmReferralRow,
} from "../../../adm/api";
import { FormIcon } from "../../../adm/components/FormIcon";
import { useMinLoading } from "../../../adm/useMinLoading";
import { stageLabel, isAwaitingSignature, canReturn } from "../../../adm/adm";
import header from "../../../adm/components/AdmHeader.module.css";
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

const STAGE_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All stages" },
  { id: "meeting_parents", label: "Meeting with Parents/Guardians" },
  { id: "home_visitation", label: "Home Visitation" },
  { id: "certification", label: "Recommendation & Certification" },
  { id: "principal_approval", label: "School Head (Principal) Approval" },
];

const ELIG_FILTERS = [
  { id: "all", label: "All eligibility" },
  { id: "eligible", label: "Eligible" },
  { id: "pending", label: "Pending" },
  { id: "ineligible", label: "Ineligible" },
] as const;

type EligFilter = (typeof ELIG_FILTERS)[number]["id"];

export default function PrincipalAdmReferralsAllPage() {
  const [rows, setRows] = React.useState<AdmReferralRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalReferred, setTotalReferred] = React.useState(0);
  const [stageCounts, setStageCounts] = React.useState<Record<string, number>>({});
  const [search, setSearch] = React.useState("");
  const [stage, setStage] = React.useState<string>("all");
  const [elig, setElig] = React.useState<EligFilter>("all");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = useMinLoading(600);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<
    { id: string; type: "sign" | "return" } | null
  >(null);

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

  const pageRows = React.useMemo(
    () =>
      elig === "all"
        ? rows
        : rows.filter((r) => r.eligibilityStatus === elig),
    [rows, elig]
  );
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
  });

  const hasActiveFilters = stage !== "all" || elig !== "all" || search.trim() !== "";

  return (
    <section className={styles.page}>
      <div className={header.hero}>
        <h1 className={header.heroTitle}>ADM Cases – Referrals</h1>
        <p className={header.heroSubtitle}>
          Every learner referral in the ADM pipeline — full list, filterable by
          stage and searchable by student.
        </p>
      </div>

      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle>All Referrals</CardTitle>
            <CardDescription>
              {totalCount === 0
                ? "No ADM referrals on record."
                : `${totalCount} ADM referral${totalCount === 1 ? "" : "s"} in the pipeline.`}
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${styles.filterBtn} ${
                    stage !== "all" ? styles.filterActive : ""
                  }`}
                >
                  Stage
                  {stage !== "all" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {STAGE_FILTERS.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s.id}
                    checked={stage === s.id}
                    onCheckedChange={() => {
                      setStage(s.id);
                      setPage(1);
                    }}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${styles.filterBtn} ${
                    elig !== "all" ? styles.filterActive : ""
                  }`}
                >
                  Eligibility
                  {elig !== "all" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {ELIG_FILTERS.map((e) => (
                  <DropdownMenuCheckboxItem
                    key={e.id}
                    checked={elig === e.id}
                    onCheckedChange={() => {
                      setElig(e.id);
                      setPage(1);
                    }}
                  >
                    {e.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearBtn}
                onClick={() => {
                  setStage("all");
                  setElig("all");
                  setPage(1);
                }}
              >
                <X aria-hidden />
                Clear
              </Button>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className={styles.content}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Forms</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className={styles.empty}>
                    {error}
                  </TableCell>
                </TableRow>
              ) : totalCount === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className={styles.empty}>
                    {search.trim()
                      ? `No referrals match "${search}".`
                      : hasActiveFilters
                        ? "No referrals match the selected filters."
                        : "No referrals found."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
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
                        <div className={styles.forms}>
                          {r.forms && r.forms.length > 0 ? (
                            r.forms.map((f, i) => (
                              <FormIcon
                                key={f.id}
                                formType={f.formType}
                                title={f.title}
                                status={f.status}
                                index={i}
                              />
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
                          <DropdownMenuContent align="end">
                            {awaiting ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  setPendingAction({ id: r.id, type: "sign" })
                                }
                              >
                                Sign & approve
                              </DropdownMenuItem>
                            ) : null}
                            {returnable ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  setPendingAction({ id: r.id, type: "return" })
                                }
                              >
                                Return for revision
                              </DropdownMenuItem>
                            ) : null}
                            {!awaiting && !returnable ? (
                              <DropdownMenuItem disabled>No actions</DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className={styles.footer}>
          <span className={styles.footerInfo}>
            {totalCount > 0 ? `${start}–${end} of ${totalCount}` : "0 of 0"}
          </span>
          <div className={styles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || totalCount === 0}
              onClick={() => load(safePage - 1)}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || totalCount === 0}
              onClick={() => load(safePage + 1)}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </CardFooter>
      </Card>

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
    <>
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
            <Skeleton className={styles.skelCell} style={{ width: "70%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "55%" }} />
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
    </>
  );
}