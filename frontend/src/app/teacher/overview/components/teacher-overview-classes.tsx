"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import type { TeacherClassRow } from "./teacher-overview-data";
import styles from "./teacher-overview-classes.module.css";

interface TeacherOverviewClassesProps {
  classes: TeacherClassRow[];
}

export function TeacherOverviewClasses({ classes }: TeacherOverviewClassesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Classes</CardTitle>
        <CardDescription>
          The class sections assigned to you this term.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        {classes.length === 0 ? (
          <p className={styles.empty}>No classes assigned yet.</p>
        ) : (
          <div className={styles.grid}>
            {classes.map((c) => (
              <div key={c.id} className={styles.classCard}>
                <span className={styles.classSubject}>{c.subject}</span>
                <span className={styles.classMeta}>
                  {c.gradeLevel} · {c.section}
                </span>
                <div className={styles.classFoot}>
                  <span className={styles.classMeta}>
                    <Users className={styles.metaIcon} aria-hidden />
                    {c.studentCount} students
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
