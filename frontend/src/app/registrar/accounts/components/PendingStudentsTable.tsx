import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PendingStudent } from "./types";
import { formatGrade } from "@/lib/utils";
import styles from "./pending-students-table.module.css";

type Props = {
  students: PendingStudent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
};

export function PendingStudentsTable({ students, selectedId, onSelect, loading }: Props) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.name} ${s.lrn}`.toLowerCase().includes(q));
  }, [students, query]);

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headIcon}>
            <UserPlus className={styles.headIconSvg} />
          </span>
          <h2 className={styles.title}>Pending Students</h2>
        </div>
        <Badge variant="warning" className={styles.count}>
          {students.length}
        </Badge>
      </header>

      <div className={styles.search}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          placeholder="Search by name or LRN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <Table>
            <TableHeader>
              <TableRow className={styles.headRow}>
                <TableHead>LRN</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className={styles.skelRow} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : students.length === 0 ? (
        <p className={styles.empty}>No pending students for grades 11–12.</p>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>No students match your search.</p>
      ) : (
        <div className={styles.tableWrap}>
          <Table>
            <TableHeader>
              <TableRow className={styles.headRow}>
                <TableHead>LRN</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const active = s.id === selectedId;
                return (
                  <TableRow
                    key={s.id}
                    className={`${styles.rowClickable} ${active ? styles.rowActive : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(s.id);
                      }
                    }}
                  >
                    <TableCell className={styles.lrn}>{s.lrn}</TableCell>
                    <TableCell className={styles.nameCell}>{s.name}</TableCell>
                    <TableCell>
                      <span className={styles.gradeTag}>{formatGrade(s.gradeLevel)}</span>
                    </TableCell>
                    <TableCell className={styles.sectionText}>{s.section}</TableCell>
                    <TableCell>
                      <Badge variant="warning">Pending</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
