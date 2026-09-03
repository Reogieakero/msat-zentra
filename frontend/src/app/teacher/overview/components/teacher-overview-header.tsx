"use client";

import * as React from "react";
import { useSession } from "@/lib/auth/useSession";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  FileEdit,
  Flag,
  Users,
  CalendarCheck,
  Send,
} from "lucide-react";
import styles from "./teacher-overview-header.module.css";

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function KpiCard({ title, value, icon: Icon }: KpiCardProps) {
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

export function TeacherOverviewHeader() {
  const session = useSession();
  const isAdviser = session?.role === "adviser";

  const roleLabel = isAdviser ? "Adviser" : "Subject Teacher";

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.heading}>Teacher Overview</h1>
          <p className={styles.subtitle}>
            Welcome back. Here is your teaching load and recent activity.
          </p>
        </div>
        <Badge variant={isAdviser ? "default" : "outline"} className={styles.badge}>
          {roleLabel}
        </Badge>
      </div>
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>SY 2026-2027</span>
        <span className={styles.metaDot} aria-hidden />
        <span className={styles.metaItem}>Term 1</span>
      </div>
      <div className={styles.kpiGrid}>
        <KpiCard title="Classes" value={3} icon={BookOpen} />
        <KpiCard title="Pending Scores" value={2} icon={FileEdit} />
        <KpiCard title="Open Flags" value={1} icon={Flag} />
        {isAdviser && (
          <>
            <KpiCard title="Advisory Students" value={5} icon={Users} />
            <KpiCard title="Today&apos;s Attendance" value={94} icon={CalendarCheck} />
            <KpiCard title="Pending Referrals" value={2} icon={Send} />
          </>
        )}
      </div>
    </header>
  );
}