"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherEmptyState } from "../../components/TeacherEmptyCard";
import { useTeacherReports } from "@/services/teacher/reports.service";
import { ReportsScopeBar } from "./components/reports-scope-bar";
import { ReportsKpiStrip } from "./components/reports-kpi-strip";
import { ReportsClassTable } from "./components/reports-class-table";
import { ReportsDistribution } from "./components/reports-distribution";
import { ReportsActivity } from "./components/reports-activity";
import { ReportsSkeleton } from "./components/reports-skeleton";
import styles from "./components/reports.module.css";

export default function TeacherReportsPage() {
  const report = useTeacherReports();

  if (report.isPending && !report.data) {
    return <ReportsSkeleton />;
  }

  if (report.isError && !report.data) {
    return (
      <section className={styles.page} aria-label="Reports">
        <div className={styles.card}>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p role="alert" className="font-medium">
              Could not load your term report.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => report.refetch()}
              disabled={report.isFetching}
            >
              {report.isFetching ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Retrying</span>
                </>
              ) : (
                "Try again"
              )}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const data = report.data;
  if (!data) {
    return <ReportsSkeleton />;
  }

  return (
    <section className={styles.page} aria-label="Teacher term report">
      <ReportsScopeBar data={data} />

      {data.classes.length === 0 ? (
        <div className={styles.card}>
          <TeacherEmptyState
            icon={BookOpen}
            title="No classes in this term"
            hint="Your report appears once sections and subjects are assigned to you for the selected term."
          />
        </div>
      ) : (
        <>
          <ReportsKpiStrip summary={data.summary} />

          <ReportsClassTable rows={data.classes} />

          <div className={styles.panels}>
            <ReportsDistribution distribution={data.distribution} />
            <ReportsActivity activity={data.activity} summary={data.summary} />
          </div>
        </>
      )}
    </section>
  );
}
