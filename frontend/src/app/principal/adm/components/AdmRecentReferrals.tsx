"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { Check, ArrowLeftRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { fetchAdmDashboard, type AdmLatestReferred } from "../api";
import { ADM_PIPELINE } from "../adm";
import styles from "./AdmRecentReferrals.module.css";

const STAGE_COLORS: Record<string, string> = {
  anecdotal: "#a8a29e",
  consultation: "#f59e0b",
  meeting_parents: "#3b82f6",
  home_visitation: "#8b5cf6",
  certification: "#0ea5e9",
  principal_approval: "#166534",
  enrollment_monitoring: "#10b981",
  completion: "#64748b",
};

function stageLabel(stage: string): string {
  return ADM_PIPELINE.find((s) => s.stage === stage)?.label ?? stage;
}

export function AdmRecentReferrals() {
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
  });

  const referrals: AdmLatestReferred[] = React.useMemo(
    () => data?.latestReferred ?? [],
    [data]
  );

  const handleSign = (id: string) => {
    apiClient.post(`/api/adm/${id}/principal-approve`);
  };

  const handleReturn = (id: string) => {
    apiClient.post(`/api/adm/${id}/principal-return`);
  };

  const canSign = (row: AdmLatestReferred) =>
    row.stage === "principal_approval" &&
    !row.approvedBy &&
    row.eligibilityStatus === "eligible";

  const canReturn = (row: AdmLatestReferred) => !!row.approvedBy;

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>
            Latest ADM cases requiring your review or already signed.
          </CardDescription>
        </div>
        <Link href="/principal/adm/referrals/all" className={styles.seeAll}>
          See All
        </Link>
      </CardHeader>

      <CardContent className={styles.content}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Eligibility</TableHead>
              <TableHead>Prepared By</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <SkeletonRows />
            ) : referrals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className={styles.empty}>
                  No recent referrals found.
                </TableCell>
              </TableRow>
            ) : (
              referrals.map((row) => (
                <TableRow key={row.id} className={styles.row}>
                  <TableCell>
                    <div className={styles.studentCell}>
                      <span className={styles.studentName}>{row.student}</span>
                      <span className={styles.studentLrn}>{row.lrn}</span>
                    </div>
                  </TableCell>
                  <TableCell className={styles.grade}>{row.grade}</TableCell>
                  <TableCell>
                    <span
                      className={styles.stageChip}
                      style={{
                        backgroundColor: `${STAGE_COLORS[row.stage]}15`,
                        color: STAGE_COLORS[row.stage],
                        borderColor: `${STAGE_COLORS[row.stage]}40`,
                      }}
                    >
                      {stageLabel(row.stage)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`${styles.eligibility} ${
                        row.eligibilityStatus === "eligible"
                          ? styles.eligible
                          : row.eligibilityStatus === "ineligible"
                          ? styles.ineligible
                          : styles.pending
                      }`}
                    >
                      {row.eligibilityStatus === "eligible"
                        ? "Eligible"
                        : row.eligibilityStatus === "ineligible"
                        ? "Ineligible"
                        : "Pending"}
                    </span>
                  </TableCell>
                  <TableCell className={styles.preparedBy}>{row.preparedBy}</TableCell>
                  <TableCell>
                    {canSign(row) ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.signBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSign(row.id);
                          }}
                        >
                          <Check aria-hidden />
                          Sign
                        </button>
                      </div>
                    ) : canReturn(row) ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.returnBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReturn(row.id);
                          }}
                        >
                          <ArrowLeftRight aria-hidden />
                          Return
                        </button>
                      </div>
                    ) : (
                      <span className={styles.noAction}>—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className={styles.footer}>
        <span className={styles.footerInfo}>
          {referrals.length > 0
            ? `1–${referrals.length} of ${referrals.length}`
            : "0 of 0"}
        </span>
      </CardFooter>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
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
            <Skeleton className={styles.skelCell} style={{ width: "40%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelCell} style={{ width: "70%" }} />
          </TableCell>
          <TableCell>
            <Skeleton className={styles.skelAction} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
