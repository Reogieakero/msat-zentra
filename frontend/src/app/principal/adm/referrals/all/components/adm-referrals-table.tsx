"use client";

import * as React from "react";
import { ArrowLeftRight, Check, FolderOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import {
  admStageTone,
  eligibilityLabel,
  eligibilityTone,
} from "@/lib/labels/status-tone";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import {
  canReturn,
  isAwaitingSignature,
  stageLabel,
  type AdmCase,
} from "../../../adm";
import styles from "../all.module.css";

export type AdmReferralLaneFilter = "all" | "awaiting" | "returned" | "signed";

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

export function matchesLane(row: AdmReferralRow, lane: AdmReferralLaneFilter) {
  if (lane === "returned") return row.returnedAt !== null;
  if (lane === "signed") return row.approvedBy !== null;
  if (lane === "awaiting")
    return row.approvedBy === null && row.returnedAt === null;
  return true;
}

const COLUMNS = [
  "Student",
  "Stage",
  "Eligibility",
  "Status",
  "Forms",
  "Dates",
  "Actions",
];

export function AdmReferralsTable({
  rows,
  totalCount,
  loading,
  isFetching = false,
  error,
  search,
  laneFilter,
  actionId,
  onRequestSign,
  onRequestReturn,
  onViewForms,
  onRetry,
}: {
  rows: AdmReferralRow[];
  totalCount: number;
  loading: boolean;
  isFetching?: boolean;
  error: string | null;
  search: string;
  laneFilter: AdmReferralLaneFilter;
  actionId: string | null;
  onRequestSign: (id: string) => void;
  onRequestReturn: (id: string) => void;
  onViewForms: (row: AdmReferralRow) => void;
  onRetry: () => void;
}) {
  const visibleRows = React.useMemo(
    () => rows.filter((row) => matchesLane(row, laneFilter)),
    [rows, laneFilter],
  );

  if (loading) {
    return (
      <div className="relative overflow-x-auto rounded-md border">
        <Table className="w-full" aria-label="Loading referral cases">
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </TableCell>
                {Array.from({ length: COLUMNS.length - 1 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="alert">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <PrincipalEmptyState
        icon={ShieldCheck}
        title="No referrals found"
        hint={
          search.trim()
            ? `No referrals match "${search}".`
            : "Endorsed cases will appear here once filed."
        }
      />
    );
  }

  return (
    <div
      className="relative overflow-x-auto rounded-md border"
      aria-busy={isFetching || undefined}
    >
      <Table className="w-full" aria-label="ADM referral cases">
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No cases in this lane on this page.
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => {
              const awaiting = isAwaitingSignature(asCase(row));
              const returned = row.returnedAt !== null;
              const signed = row.approvedBy !== null;
              const formCount = row.forms?.length ?? 0;
              const busy = actionId === row.id;
              const locked = actionId !== null;
              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-56">
                    <div className="flex min-w-0 items-center gap-2">
                      <StudentMascot name={row.student} seed={row.lrn} size={32} />
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <p className="max-w-full truncate text-sm font-medium">
                          {row.student}
                        </p>
                        <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
                          <Pill label="LRN" className="tabular-nums">
                            {row.lrn}
                          </Pill>
                          {row.section ? (
                            <Pill tone="amber" label="Section">
                              {row.section}
                            </Pill>
                          ) : null}
                          <Pill label="Grade">{row.grade}</Pill>
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Pill
                      tone={admStageTone(row.stage)}
                      label="ADM stage"
                    >
                      {stageLabel(row.stage)}
                    </Pill>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Pill
                      tone={eligibilityTone(row.eligibilityStatus)}
                      label="Eligibility"
                    >
                      {eligibilityLabel(row.eligibilityStatus)}
                    </Pill>
                  </TableCell>
                  <TableCell className="max-w-64 min-w-52">
                    {returned ? (
                      <div className="min-w-0">
                        <Pill tone="red" label="Approval state">
                          Returned
                        </Pill>
                        <p
                          className="mt-1 line-clamp-2 text-xs text-destructive"
                          title={row.returnReason ?? undefined}
                        >
                          {row.returnReason ?? "No reason recorded."}
                        </p>
                      </div>
                    ) : signed ? (
                      <Pill tone="green" label="Principal approval">
                        Signed
                      </Pill>
                    ) : (
                      <Pill tone="amber" label="Approval state">
                        Awaiting
                      </Pill>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formCount === 0 ? (
                      <span className={styles.noForms}>No forms</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] [&_svg]:size-3"
                        aria-label={`View ${formCount} linked form${formCount === 1 ? "" : "s"} for ${row.student}`}
                        title={`${formCount} linked form${formCount === 1 ? "" : "s"}`}
                        onClick={() => onViewForms(row)}
                      >
                        <FolderOpen aria-hidden />
                        {formCount}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    <span className="block">Prepared {row.datePrepared}</span>
                    {row.approvalDate ? (
                      <span className="block">Signed {row.approvalDate}</span>
                    ) : null}
                    {returned ? (
                      <span className="block text-destructive">
                        Returned {row.returnedAt}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {awaiting ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px] [&_svg]:size-3"
                          aria-label={`Sign and approve case for ${row.student}`}
                          title="Sign & approve"
                          disabled={locked}
                          aria-busy={busy || undefined}
                          onClick={() => onRequestSign(row.id)}
                        >
                          {busy ? <Spinner aria-hidden /> : <Check aria-hidden />}
                          Sign
                        </Button>
                      ) : null}
                      {canReturn(asCase(row)) && !returned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] [&_svg]:size-3"
                          aria-label={`Return case for ${row.student} for revision`}
                          title="Return for revision"
                          disabled={locked}
                          onClick={() => onRequestReturn(row.id)}
                        >
                          <ArrowLeftRight aria-hidden />
                          Return
                        </Button>
                      ) : null}
                      {!awaiting && (!canReturn(asCase(row)) || returned) ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
