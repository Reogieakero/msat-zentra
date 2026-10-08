"use client";
import * as React from "react";
import { ChevronDown, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AccessRequestStatus,
  AdviserAccessRequest,
} from "./adviser-access-types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access-tables.module.css";
import { Pager, usePager } from "./table-pager";
import { AdviseeDetail, initials } from "./adviser-access-shared";
function historyBadge(status: AccessRequestStatus) {
  if (status === "approved") return <Badge variant="default">Approved</Badge>;
  return <Badge variant="destructive">Denied</Badge>;
}
export function HistoryTable({
  requests,
  pageSize = 15,
}: {
  requests: AdviserAccessRequest[];
  pageSize?: number;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const pager = usePager(requests.length, pageSize);
  const pageRows = requests.slice(
    (pager.safePage - 1) * pageSize,
    pager.safePage * pageSize
  );
  return (
    <section className={assign.card} aria-labelledby="adviser-history">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="adviser-history" className="text-base font-semibold">
            Decision History
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved and denied SF10 access requests — {requests.length} decided.
          </p>
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {requests.length === 0 ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              <ShieldQuestion />
            </span>
            <p className={styles.emptyTitle}>No decisions yet</p>
            <p className={styles.emptyHint}>
              Approved and denied requests will appear here.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Adviser</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const expanded = expandedId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow>
                        <TableCell className={styles.expandCell}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={expanded ? `Collapse ${r.adviserName}` : `Expand ${r.adviserName}`}
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                          >
                            <ChevronDown
                              aria-hidden
                              className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                            />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className={styles.adviserCell}>
                            <Avatar size="sm" className="shrink-0">
                              <AvatarFallback>{initials(r.adviserName)}</AvatarFallback>
                            </Avatar>
                            <div className={styles.studentCell}>
                              <span className={styles.studentName}>{r.adviserName}</span>
                              <span className={styles.studentLrn}>{r.employeeId}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={styles.gradeTag}>
                            {r.gradeLevel} · {r.section}
                          </span>
                        </TableCell>
                        <TableCell>{historyBadge(r.status)}</TableCell>
                        <TableCell className={styles.reasonCell}>
                          {r.decisionReason ?? "—"}
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className={styles.detailRow}>
                          <TableCell colSpan={5}>
                            <AdviseeDetail request={r} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {requests.length > 0 && (
        <Pager
          total={requests.length}
          totalPages={pager.totalPages}
          safePage={pager.safePage}
          start={pager.start}
          end={pager.end}
          setPage={pager.setPage}
        />
      )}
    </section>
  );
}
