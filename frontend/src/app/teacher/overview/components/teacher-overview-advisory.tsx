"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AdvisoryStatusRow, AdvisoryReferralRow, AdvisoryAdmRow } from "./teacher-overview-data";
import styles from "./teacher-overview-advisory.module.css";

interface StatusBadgeProps {
  level: AdvisoryStatusRow["riskLevel"];
}

function StatusBadge({ level }: StatusBadgeProps) {
  const variant = level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

interface FlagBadgeProps {
  flag: AdvisoryStatusRow["flag"];
}

function FlagBadge({ flag }: FlagBadgeProps) {
  if (flag === "none") return null;
  const label = flag.charAt(0).toUpperCase() + flag.slice(1);
  return <Badge variant="outline">{label}</Badge>;
}

interface StageLabelProps {
  stage: AdvisoryAdmRow["stage"];
}

function StageLabel({ stage }: StageLabelProps) {
  const label = stage.replace(/_/g, " ");
  return <span className={styles.stageLabel}>{label}</span>;
}

interface TeacherOverviewAdvisoryProps {
  students: AdvisoryStatusRow[];
  referrals: AdvisoryReferralRow[];
  admCases: AdvisoryAdmRow[];
}

export function TeacherOverviewAdvisory({
  students,
  referrals,
  admCases,
}: TeacherOverviewAdvisoryProps) {
  const statusCounts = React.useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0 };
    students.forEach((s) => { counts[s.riskLevel] += 1; });
    return counts;
  }, [students]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Advisory Students</CardTitle>
          <CardDescription>
            Status breakdown for your advisees. You see the category only, never the private write-up.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <div className={styles.statusGrid}>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>Low</span>
              <span className={styles.statusCount}>{statusCounts.Low}</span>
            </div>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>Moderate</span>
              <span className={styles.statusCount}>{statusCounts.Moderate}</span>
            </div>
            <div className={styles.statusChip}>
              <span className={styles.statusLabel}>High</span>
              <span className={styles.statusCount}>{statusCounts.High}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell className={styles.cellSubject}>{s.name}</TableCell>
                  <TableCell>{s.section}</TableCell>
                  <TableCell><StatusBadge level={s.riskLevel} /></TableCell>
                  <TableCell><FlagBadge flag={s.flag} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className={styles.twoCol}>
        <Card>
          <CardHeader>
            <CardTitle>Pending Referrals</CardTitle>
            <CardDescription>
              Referrals you&apos;ve sent that are still open.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.content}>
            {referrals.length === 0 ? (
              <p className={styles.empty}>No pending referrals.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className={styles.cellSubject}>{r.studentName}</TableCell>
                      <TableCell>{r.targetRole}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "pending" ? "warning" : r.status === "in_progress" ? "default" : "outline"}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ADM Cases</CardTitle>
            <CardDescription>
              Advisees in the Alternative Delivery Mode pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.content}>
            {admCases.length === 0 ? (
              <p className={styles.empty}>No ADM cases yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admCases.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className={styles.cellSubject}>{c.studentName}</TableCell>
                      <TableCell><StageLabel stage={c.stage} /></TableCell>
                      <TableCell>{c.updatedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}