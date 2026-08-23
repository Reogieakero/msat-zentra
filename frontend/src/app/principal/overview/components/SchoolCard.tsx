import * as React from "react";
import { Users, GraduationCap, ClipboardList, NotebookPen } from "lucide-react";
import { Kpi } from "./Kpi";
import styles from "./school-card.module.css";

export type SchoolCardProps = {
  schoolName: string;
  kpis: {
    enrollment: number;
    activeSections: number;
    teachers: number;
    anecdotals: number;
  };
  loading?: boolean;
};

export function SchoolCard({ schoolName, kpis, loading = false }: SchoolCardProps) {
  return (
    <article className={styles.schoolCard}>
      <div className={styles.schoolHead}>
        <h2 className={styles.schoolName}>{schoolName}</h2>
      </div>

      <dl className={styles.kpiGrid}>
        <Kpi
          icon={<Users className={styles.kpiIcon} aria-hidden />}
          value={kpis.enrollment.toLocaleString()}
          label="Enrolled Students"
          description="Total learners officially enrolled and attending across all grade levels this term."
          loading={loading}
        />
        <Kpi
          icon={<GraduationCap className={styles.kpiIcon} aria-hidden />}
          value={kpis.activeSections.toLocaleString()}
          label="Active Sections"
          description="Sections currently running with assigned advisers and an active class schedule."
          loading={loading}
        />
        <Kpi
          icon={<ClipboardList className={styles.kpiIcon} aria-hidden />}
          value={kpis.teachers.toLocaleString()}
          label="Teachers"
          description="Faculty members on the active roster, including subject teachers and advisory staff."
          loading={loading}
        />
        <Kpi
          icon={<NotebookPen className={styles.kpiIcon} aria-hidden />}
          value={kpis.anecdotals.toLocaleString()}
          label="Anecdotal Records"
          description="Behavioral and observational entries filed by teachers and guidance this term."
          loading={loading}
        />
      </dl>
    </article>
  );
}
