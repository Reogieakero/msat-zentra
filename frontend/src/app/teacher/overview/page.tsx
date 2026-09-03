"use client";

import * as React from "react";
import {
  BookOpen,
  FileEdit,
  Flag,
  Clock,
  Users,
  CalendarCheck,
  Send,
} from "lucide-react";
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
import { useSession } from "@/lib/auth/useSession";
import { MOCK_TEACHER_OVERVIEW } from "./components/teacher-overview-data";
import type { AdvisoryStatusRow, AdvisoryAdmRow } from "./components/teacher-overview-data";
import { TeacherOverviewHeader } from "./components/teacher-overview-header";
import styles from "./components/teacher-overview.module.css";

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

function StatusBadge({ level }: { level: AdvisoryStatusRow["riskLevel"] }) {
  const variant = level === "High" ? "destructive" : level === "Moderate" ? "warning" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

function FlagBadge({ flag }: { flag: AdvisoryStatusRow["flag"] }) {
  if (flag === "none") return null;
  const label = flag.charAt(0).toUpperCase() + flag.slice(1);
  return <Badge variant="outline">{label}</Badge>;
}

function StageLabel({ stage }: { stage: AdvisoryAdmRow["stage"] }) {
  const label = stage.replace(/_/g, " ");
  return <span className={styles.stageLabel}>{label}</span>;
}

export default function TeacherOverviewPage() {
  const session = useSession();
  const isAdviser = session?.role === "adviser";
  const data = MOCK_TEACHER_OVERVIEW;

  const classes = data.classes;
  const kpi = data.kpi;
  const activity = data.recentActivity;
  const advisory = data.advisory;

  const statusCounts = React.useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0 };
    advisory.students.forEach((s) => { counts[s.riskLevel] += 1; });
    return counts;
  }, [advisory.students]);

  const attendanceRate = React.useMemo(() => {
    const latest = advisory.attendance[0];
    if (!latest) return null;
    const total = latest.present + latest.absent + latest.late + latest.excused;
    if (total === 0) return null;
    return Math.round((latest.present / total) * 100);
  }, [advisory.attendance]);

  return (
    <section className={styles.page}>
      <TeacherOverviewHeader />

      <div className={styles.kpiGrid}>
        <KpiCard title="Classes" value={kpi.classCount} icon={BookOpen} />
        <KpiCard title="Pending Scores" value={kpi.pendingAssessments} icon={FileEdit} />
        <KpiCard title="Open Flags" value={kpi.openFlags} icon={Flag} />
        {isAdviser && (
          <>
            <KpiCard title="Advisory Students" value={advisory.students.length} icon={Users} />
            <KpiCard title="Today&apos;s Attendance" value={attendanceRate ?? 0} icon={CalendarCheck} />
            <KpiCard title="Pending Referrals" value={advisory.referrals.length} icon={Send} />
          </>
        )}
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
                {classes.map((c) => (
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

      {isAdviser && (
        <>
          <hr className={styles.divider} />

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
                  {advisory.students.map((s) => (
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

          <hr className={styles.divider} />

          <div className={styles.twoCol}>
            <Card>
              <CardHeader>
                <CardTitle>Pending Referrals</CardTitle>
                <CardDescription>
                  Referrals you&apos;ve sent that are still open.
                </CardDescription>
              </CardHeader>
              <CardContent className={styles.content}>
                {advisory.referrals.length === 0 ? (
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
                      {advisory.referrals.map((r) => (
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
                {advisory.admCases.length === 0 ? (
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
                      {advisory.admCases.map((c, i) => (
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
      )}

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
              {activity.map((a, i) => (
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
    </section>
  );
}