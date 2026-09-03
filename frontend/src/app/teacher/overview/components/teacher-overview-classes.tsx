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
import type { TeacherClassRow } from "./teacher-overview-data";
import styles from "./teacher-overview-classes.module.css";

interface TeacherOverviewClassesProps {
  classes: TeacherClassRow[];
}

export function TeacherOverviewClasses({ classes }: TeacherOverviewClassesProps) {
  return (
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
  );
}