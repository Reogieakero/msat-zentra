"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import styles from "./InterventionTrackingTable.module.css";
import { RISK_VARIANT, pipelineStatus, type InterventionStudent } from "./intervention-tracking-helpers";
export function buildInterventionTrackingColumns(): ColumnDef<InterventionStudent>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.studentName,
      header: "Student",
      size: 200,
      minSize: 200,
      maxSize: 200,
      cell: ({ row }) => (
        <div className={styles.studentCell}>
          <span className={styles.studentName}>{row.original.studentName}</span>
          <span className={styles.studentLrn}>{row.original.lrn}</span>
        </div>
      ),
    },
    {
      id: "section",
      accessorFn: (row) => row.section,
      header: "Section",
      size: 130,
      minSize: 130,
      maxSize: 130,
      cell: ({ row }) => (
        <span className={styles.section}>{row.original.section}</span>
      ),
    },
    {
      id: "risk",
      accessorFn: (row) => row.riskLevel,
      header: "Risk",
      size: 120,
      minSize: 120,
      maxSize: 120,
      cell: ({ row }) => (
        <Badge variant={RISK_VARIANT[row.original.riskLevel] ?? "outline"}>
          {row.original.riskLevel}
        </Badge>
      ),
    },
    {
      id: "assignee",
      accessorFn: (row) => row.intervention?.assignedStaffName ?? "",
      header: "Assigned to",
      size: 150,
      minSize: 150,
      maxSize: 150,
      cell: ({ row }) => (
        <span className={styles.assignee}>
          {row.original.intervention?.assignedStaffName ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.intervention?.outcomeStatus ?? "",
      header: "Status",
      size: 130,
      minSize: 130,
      maxSize: 130,
      cell: ({ row }) => {
        const status = pipelineStatus(row.original.intervention);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      id: "action",
      accessorFn: (row) => row.intervention?.recommendedAction ?? "",
      header: "Recommended action",
      size: 220,
      minSize: 220,
      maxSize: 220,
      enableSorting: false,
      cell: ({ row }) => (
        <span className={styles.action}>
          {row.original.intervention?.recommendedAction ?? "—"}
        </span>
      ),
    },
  ];
}
