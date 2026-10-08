"use client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type {
  AdviserAccessRequest,
  AffectedAdvisee,
} from "./adviser-access-types";
import styles from "./adviser-access-tables.module.css";
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
export function sf10Ready(advisees: AffectedAdvisee[]): number {
  return advisees.filter((a) => a.sf10Status === "validated" || a.sf10Status === "verified").length;
}
export function Sf10Badge({ status }: { status: AffectedAdvisee["sf10Status"] }) {
  if (status === "validated")
    return <Badge variant="default">Validated</Badge>;
  if (status === "verified")
    return <Badge variant="secondary">Verified</Badge>;
  return <Badge variant="amber">Pending</Badge>;
}
export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className={styles.skelCell} style={{ width: j === 0 ? "70%" : "50%" }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
export function AdviseeDetail({ request }: { request: AdviserAccessRequest }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <span className={styles.detailTitle}>
          Affected advisees · {request.section}
        </span>
        <span className={styles.detailMeta}>
          <Badge variant="outline">SF10 read · {request.gradeLevel}</Badge>
          <Badge variant="outline">{request.affectedAdvisees.length} learners</Badge>
        </span>
      </div>
      {request.reason ? (
        <p className={styles.detailReason}>
          <strong>Request reason:</strong> {request.reason}
        </p>
      ) : null}
      <ul className={styles.adviseeList}>
        {request.affectedAdvisees.map((a) => (
          <li key={a.lrn} className={styles.adviseeItem}>
            <div className={styles.studentCell}>
              <span className={styles.studentName}>{a.name}</span>
              <span className={styles.studentLrn}>{a.lrn}</span>
            </div>
            <span className={styles.gradeTag}>{a.gradeLevel}</span>
            <Sf10Badge status={a.sf10Status} />
          </li>
        ))}
      </ul>
      {request.decisionReason ? (
        <p className={styles.detailReason} data-status={request.status}>
          <strong>Decision:</strong> {request.decisionReason}
        </p>
      ) : null}
    </div>
  );
}
