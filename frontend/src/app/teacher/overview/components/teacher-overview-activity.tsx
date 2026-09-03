"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { TeacherActivityRow } from "./teacher-overview-data";
import styles from "./teacher-overview-activity.module.css";

interface TeacherOverviewActivityProps {
  activity: TeacherActivityRow[];
}

export function TeacherOverviewActivity({ activity }: TeacherOverviewActivityProps) {
  return (
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
  );
}