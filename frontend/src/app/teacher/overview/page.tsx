"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  FileEdit,
  Flag,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { fetchTeacherOverview } from "./components/teacher-overview-data";
import type { TeacherClassRow, TeacherActivityRow } from "./components/teacher-overview-data";
import styles from "./teacher-overview.module.css";

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <h2 className={styles.kpiTitle}>{title}</h2>
        <Icon className={styles.kpiIcon} aria-hidden />
      </div>
      <span className={styles.kpiValue}>{value}</span>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.kpiCard}>
      <Skeleton className={styles.skelHeader} />
      <Skeleton className={styles.skelValue} />
    </div>
  );
}

export default function TeacherOverviewPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["teacher-overview"],
    queryFn: fetchTeacherOverview,
  });

  const classes = data?.classes ?? [];
  const kpi = data?.kpi;
  const activity = data?.recentActivity ?? [];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Teacher Overview</h1>
        <p className={styles.subtitle}>
          Welcome back. Here is your teaching load and recent activity.
        </p>
      </header>

      {isPending ? (
        <div className={styles.kpiGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <p className={styles.empty}>Could not load your overview.</p>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard title="Classes" value={kpi?.classCount ?? 0} icon={BookOpen} />
            <KpiCard title="Pending Scores" value={kpi?.pendingAssessments ?? 0} icon={FileEdit} />
            <KpiCard title="Open Flags" value={kpi?.openFlags ?? 0} icon={Flag} />
          </div>

          <hr className={styles.divider} />

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Classes</CardTitle>
              <CardDescription>
                Scheduled sessions for today, ordered by period.
              </CardDescription>
            </CardHeader>
            <CardContent className={styles.content}>
              {classes.length === 0 ? (
                <p className={styles.empty}>No classes scheduled for today.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Students</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {classes.map((c: TeacherClassRow) => (
                      <TableRow key={c.id}>
                        <TableCell className={styles.cellSubject}>{c.subject}</TableCell>
                        <TableCell>{c.gradeLevel}</TableCell>
                        <TableCell>{c.section}</TableCell>
                        <TableCell>{c.schedule}</TableCell>
                        <TableCell>{c.studentCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <hr className={styles.divider} />

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest grade and flag actions this term.
              </CardDescription>
            </CardHeader>
            <CardContent className={styles.content}>
              {activity.length === 0 ? (
                <p className={styles.empty}>No recent activity.</p>
              ) : (
                <ul className={styles.activityList}>
                   {activity.map((a: TeacherActivityRow, i: number) => (
                    <li key={i} className={styles.activityItem}>
                      <span className={styles.activityAction}>{a.action}</span>
                      <span className={styles.activityTarget}>{a.target}</span>
                      <span className={styles.activityWhen}>
                        <Clock className={styles.activityClock} aria-hidden />
                        {a.when}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
