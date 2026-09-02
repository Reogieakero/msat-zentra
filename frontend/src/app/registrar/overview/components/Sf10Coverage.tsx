"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRegistrarOverview } from "./overview-data";
import styles from "./Sf10Coverage.module.css";

const LIST_LIMIT = 6;

const CUSTODY_SEGMENTS = [
  { key: "released", label: "Released", color: "#16a34a" },
  { key: "available", label: "Available", color: "#2563eb" },
  { key: "attach", label: "Attach", color: "#cbd5e1" },
] as const;

export function Sf10Coverage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
  });

  const sf10 = data?.sf10;
  const total = sf10?.total ?? 0;
  const missing = React.useMemo(() => data?.missingSf10 ?? [], [data]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return missing;
    return missing.filter((m) => `${m.student} ${m.lrn} ${m.section}`.toLowerCase().includes(q));
  }, [missing, query]);

  const goSf10 = React.useCallback(() => {
    router.push("/registrar/sf10");
  }, [router]);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>SF10 Coverage</CardTitle>
          <CardDescription>
            Custody status and where G11–12 SF10 records are still missing this term.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="destructive" className={styles.missingBadge}>
            {isPending ? "…" : `${missing.length} missing`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.skelWrap}>
            <Skeleton className={styles.skelBlock} />
            <Skeleton className={styles.skelBlock} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load SF10 coverage.</p>
        ) : (
          <div className={styles.layout}>
            <section className={styles.custody}>
              <h3 className={styles.blockTitle}>Custody breakdown</h3>

              {total === 0 ? (
                <p className={styles.empty}>No SF10 records are on file for the grade band.</p>
              ) : (
                <>
                  <div className={styles.bar} role="img" aria-label="SF10 records by custody status">
                    {CUSTODY_SEGMENTS.map((seg) => {
                      const value = sf10?.[seg.key] ?? 0;
                      return (
                        <span
                          key={seg.key}
                          className={styles.barSegment}
                          style={{ flexBasis: `${(value / total) * 100}%`, backgroundColor: seg.color }}
                        />
                      );
                    })}
                  </div>

                  <ul className={styles.legend}>
                    {CUSTODY_SEGMENTS.map((seg) => {
                      const value = sf10?.[seg.key] ?? 0;
                      return (
                        <li key={seg.key} className={styles.legendItem}>
                          <span className={styles.legendLabel}>
                            <span
                              className={styles.legendDot}
                              style={{ backgroundColor: seg.color }}
                              aria-hidden
                            />
                            {seg.label}
                          </span>
                          <span className={styles.legendCount}>{value}</span>
                        </li>
                      );
                    })}
                    <li className={styles.legendItem}>
                      <span className={styles.legendLabel}>
                        <span className={styles.legendDot} style={{ backgroundColor: "#dc2626" }} aria-hidden />
                        Missing
                      </span>
                      <span className={styles.legendCount}>{missing.length}</span>
                    </li>
                  </ul>

                  <p className={styles.summary}>
                    {total} SF10 record{total !== 1 ? "s" : ""} on file across the grade band
                    ({sf10?.released ?? 0} released, {sf10?.available ?? 0} available,{" "}
                    {sf10?.attach ?? 0} attached).
                  </p>
                </>
              )}

              {missing.length > 0 && (
                <div className={styles.alert}>
                  <AlertTriangle className={styles.alertIcon} aria-hidden />
                  <p className={styles.alertText}>
                    <strong>{missing.length}</strong> G11–12 student
                    {missing.length !== 1 ? "s have" : " has"} no SF10 record on file yet.
                  </p>
                  <Button size="sm" className={styles.alertBtn} onClick={goSf10}>
                    Attach records
                  </Button>
                </div>
              )}
            </section>

            <section className={styles.missing}>
              <div className={styles.missingHead}>
                <h3 className={styles.blockTitle}>Missing SF10</h3>
                <div className={styles.searchWrap}>
                  <Search className={styles.searchIcon} aria-hidden />
                  <Input
                    className={styles.search}
                    placeholder="Search name, LRN, section…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search students missing an SF10 record"
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className={styles.empty}>
                        {missing.length === 0
                          ? "All G11–12 students have an SF10 record on file."
                          : query.trim()
                            ? `No students match "${query}".`
                            : "Nothing missing."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(0, LIST_LIMIT).map((m) => (
                      <TableRow key={m.lrn} className={styles.clickableRow} onClick={goSf10}>
                        <TableCell>
                          <div className={styles.studentCell}>
                            <span className={styles.studentName}>{m.student}</span>
                            <span className={styles.studentLrn}>{m.lrn}</span>
                          </div>
                        </TableCell>
                        <TableCell className={styles.sectionCell}>{m.section}</TableCell>
                        <TableCell>
                          <span className={styles.gradeTag}>{m.grade}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className={styles.missingFooter}>
                {missing.length > LIST_LIMIT && (
                  <span className={styles.missingMore}>
                    Showing {Math.min(LIST_LIMIT, filtered.length)} of {filtered.length}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={goSf10}>
                  View all students
                </Button>
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}