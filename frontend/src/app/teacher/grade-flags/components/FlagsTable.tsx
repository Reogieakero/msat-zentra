"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  REASON_LABELS,
  STATUS_LABELS,
  formatAge,
  type GradeFlagRow,
} from "./grade-flags-data";
import styles from "./FlagsTable.module.css";

const STATUS_VARIANTS = {
  open: "secondary",
  resolved: "success",
  escalated: "destructive",
} as const;

interface FlagsTableProps {
  title: string;
  description: string;
  rows: GradeFlagRow[];
  emptyText: string;
  actorColumn: "raised" | "owner";
  onResolve?: (row: GradeFlagRow) => void;
}

export function FlagsTable({
  title,
  description,
  rows,
  emptyText,
  actorColumn,
  onResolve,
}: FlagsTableProps) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        {rows.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject · Section</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>{actorColumn === "raised" ? "Raised by" : "Owner"}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age</TableHead>
                  {onResolve ? <TableHead className={styles.actionHead}>Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const actionable =
                    !!onResolve && (row.status === "open" || row.status === "escalated");
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className={styles.student}>{row.student.name}</span>
                        <span className={styles.lrn}>{row.student.lrn}</span>
                      </TableCell>
                      <TableCell>
                        <span className={styles.student}>{row.subject.name}</span>
                        <span className={styles.lrn}>{row.section.name}</span>
                      </TableCell>
                      <TableCell>Term {row.term.termNumber}</TableCell>
                      <TableCell>
                        <span className={styles.student}>{REASON_LABELS[row.reason]}</span>
                        {row.note ? <span className={styles.lrn}>{row.note}</span> : null}
                      </TableCell>
                      <TableCell>
                        {actorColumn === "raised" ? row.raisedBy.fullName : row.owner?.fullName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status]}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className={styles.age}>
                        {row.status === "resolved" ? "—" : formatAge(row.ageDays)}
                      </TableCell>
                      {onResolve ? (
                        <TableCell className={styles.actionHead}>
                          {actionable ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onResolve(row)}
                            >
                              Resolve
                            </Button>
                          ) : (
                            <span className={styles.lrn}>—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
