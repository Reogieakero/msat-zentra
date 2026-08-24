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
import { ChevronRight } from "lucide-react";
import type { SectionSummary } from "../mockData";
import styles from "../academics.module.css";

interface Props {
  sections: SectionSummary[];
  loading: boolean;
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
}

export function SectionSummaryTable({
  sections,
  loading,
  selectedSectionId,
  onSelectSection,
}: Props) {
  if (loading) {
    return (
      <div className={styles.tableWrap}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className={styles.tableWrap}>
        <p className={styles.empty}>No sections match.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <Table>
        <TableHeader className={styles.stickyHead}>
          <TableRow>
            <TableHead aria-label="Select" className="w-8" />
            <TableHead>Section</TableHead>
            <TableHead>Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((s) => {
            const active = s.sectionId === selectedSectionId;
            return (
              <TableRow
                key={s.sectionId}
                className={`${styles.selectRow} ${active ? styles.selectRowActive : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelectSection(s.sectionId)}
              >
                <TableCell className="w-8">
                  <ChevronRight
                    className={`${styles.chevron} ${active ? styles.chevronOpen : ""}`}
                    aria-hidden
                  />
                </TableCell>
                <TableCell className="font-medium">{s.section}</TableCell>
                <TableCell>{s.grade}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
