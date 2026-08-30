"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { FinalGrade } from "./types";
import MagicBento from "@/components/ui/magic-bento/MagicBento";
import styles from "./FinalGradeApprovalTable.module.css";

type Props = {
  rows: FinalGrade[];
  onApprove: (id: string) => void;
  approving?: string | null;
};

export function FinalGradeApprovalTable({ rows, onApprove, approving }: Props) {
  const [active, setActive] = React.useState<FinalGrade | null>(null);

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No locked finals awaiting approval</p>
        <p className={styles.emptyHint}>
          Every G11–12 final grade in this view has been validated. New locked
          finals from advisers will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <Table>
        <TableHeader>
          <TableRow className={styles.headRow}>
            <TableHead>LRN</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Term</TableHead>
            <TableHead>Computed</TableHead>
            <TableHead>Transmuted</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const approved = r.status === "approve";
            return (
              <TableRow
                key={r.id}
                className={styles.rowClickable}
                role="button"
                tabIndex={0}
                onClick={() => setActive(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActive(r);
                  }
                }}
              >
                <TableCell className={styles.lrn}>{r.lrn}</TableCell>
                <TableCell className={styles.nameCell}>{r.name}</TableCell>
                <TableCell>
                  <span className={styles.gradeTag}>{r.gradeLevel}</span>
                </TableCell>
                <TableCell className={styles.sectionText}>{r.section}</TableCell>
                <TableCell>{r.subject}</TableCell>
                <TableCell className={styles.muted}>{r.term}</TableCell>
                <TableCell className={`${styles.numCol} ${styles.mono}`}>
                  {r.computedAverage.toFixed(1)}
                </TableCell>
                <TableCell className={`${styles.numCol} ${styles.mono}`}>
                  {r.transmutedGrade}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.remarks === "Passed"
                        ? "secondary"
                        : r.remarks === "Failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {r.remarks}
                  </Badge>
                </TableCell>
                <TableCell>
                  {approved ? (
                    <Badge variant="default">Approve</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className={styles.sheet}>
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle>{active.name}</SheetTitle>
                <SheetDescription>
                  Final grade approval · {active.gradeLevel} {active.section}
                </SheetDescription>
              </SheetHeader>

              <div className={styles.sheetBody}>
                <MagicBento
                  textAutoHide={true}
                  enableStars
                  enableSpotlight
                  enableBorderGlow={true}
                  enableTilt={false}
                  enableMagnetism={false}
                  clickEffect
                  spotlightRadius={400}
                  particleCount={12}
                  glowColor="46, 234, 46"
                  cards={[
                    { label: "LRN", title: active.lrn, description: "" },
                    {
                      label: "Grade / Section",
                      title: `${active.gradeLevel} · ${active.section}`,
                      description: "",
                    },
                    { label: "Subject", title: active.subject, description: "" },
                    { label: "Term", title: active.term, description: "" },
                    {
                      label: "Computed Average",
                      title: active.computedAverage.toFixed(1),
                      description: "",
                    },
                    {
                      label: "Transmuted Grade",
                      title: String(active.transmutedGrade),
                      description: "",
                    },
                    {
                      label: "Remarks",
                      title: active.remarks,
                      description: "",
                    },
                    {
                      label: "Status",
                      title: active.status === "approve" ? "Approved" : "Pending",
                      description: "",
                    },
                  ]}
                />
              </div>

              <SheetFooter>
                {active.status === "approve" ? (
                  <p className={styles.sheetDone}>This final grade has been validated.</p>
                ) : (
                  <Button
                    variant="default"
                    className={styles.approveBtn}
                    disabled={approving !== null}
                    onClick={() => {
                      onApprove(active.id);
                      setActive(null);
                    }}
                  >
                    Approve final grade
                  </Button>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
