"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History } from "lucide-react";import { apiClient } from "@/lib/api/client";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatSection, formatGrade } from "@/lib/utils";
import styles from "./accounts-audit.module.css";
import pageStyles from "../accounts.module.css";

const PAGE_SIZE = 10;

export type AccountsAuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  studentName: string;
  lrn: string | null;
  gradeLevel: string | null;
  section: string | null;
  action: "approve" | "reject";
  reason: string;
};

type AuditResponse = {
  entries: AccountsAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const ROLE_LABELS: Record<string, string> = {
  registrar: "Registrar",
  record_keeper: "Record Keeper",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountsAudit() {
  const [page, setPage] = React.useState(1);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["accounts-audit", page],
    queryFn: () =>
      apiClient
        .get<AuditResponse>("/api/registrar/accounts-audit", {
          params: { page, pageSize: PAGE_SIZE },
        })
        .then((res) => res.data),
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  return (
    <Card className={pageStyles.card}>
      <CardHeader className={pageStyles.header}>
        <div className={pageStyles.headerText}>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden />
            Accounts Audit Trail
          </CardTitle>
          <CardDescription className="mt-1">
            {total === 0
              ? "No account approval actions on record."
              : `${total} ${total === 1 ? "action" : "actions"} — approvals & rejections processed in this session.`}
          </CardDescription>
        </div>
        <CardAction className={pageStyles.headerActions}>
          <Badge variant="secondary" className={pageStyles.countBadge}>
            {total} recorded
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className={pageStyles.content}>
        {isPending ? (
          <AuditSkeleton />
        ) : entries.length === 0 ? (
          <div className={pageStyles.empty}>
            <p>
              Approve or reject a pending account above and the action will
              appear here as an immutable audit entry.
            </p>
          </div>
        ) : (
          <div className={styles.wrap}>
            <Table>
              <TableHeader>
                <TableRow className={styles.headRow}>
                  <TableHead className={styles.expandCol} />
                  <TableHead className={styles.colStudent}>Student</TableHead>
                  <TableHead className={styles.colSection}>Grade / Section</TableHead>
                  <TableHead className={styles.colAction}>Action</TableHead>
                  <TableHead className={styles.colActor}>Processed by</TableHead>
                  <TableHead className={styles.colWhen}>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const approved = e.action === "approve";
                  const expanded = expandedId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      <TableRow
                        className={styles.row}
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <TableCell className={styles.expandCol}>
                          <ChevronRight
                            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                            aria-hidden
                          />
                        </TableCell>
                        <TableCell className={styles.colStudent} data-label="Student">
                          <div className="flex flex-col gap-0.5">
                            <span className={styles.studentName}>{e.studentName}</span>
                            <span className={`${styles.mono} ${styles.studentLrn}`}>
                              {e.lrn ?? "No LRN"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={styles.colSection} data-label="Grade / Section">
                          <span className={styles.section}>
                            {e.section ? formatSection(e.section) : e.gradeLevel ? formatGrade(e.gradeLevel) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className={styles.colAction} data-label="Action">
                          <Badge
                            variant={approved ? "success" : "destructive"}
                            className={styles.actionBadge}
                          >
                            {approved ? "Approved" : "Rejected"}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.colActor} data-label="Processed by">
                          <div className="flex flex-col gap-0.5">
                            <span className={styles.actorName}>{e.actor}</span>
                            <span className={styles.actorRole}>
                              {ROLE_LABELS[e.actorRole] ?? e.actorRole}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`${styles.mono} ${styles.colWhen}`}
                          data-label="Timestamp"
                        >
                          {formatTimestamp(e.timestamp)}
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className={styles.detailRow} onClick={(ev) => ev.stopPropagation()}>
                          <TableCell className={styles.expandCol} />
                          <TableCell colSpan={5}>
                            <DetailDiff entry={e} />
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
      </CardContent>

      {!isPending && total > 0 ? (
        <CardFooter className={pageStyles.footer}>
          <span className={pageStyles.footerInfo}>
            {`${start}–${end} of ${total}`}
          </span>
          <div className={pageStyles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function DetailDiff({ entry }: { entry: AccountsAuditEntry }) {
  const approved = entry.action === "approve";
  const before = "Pending";
  const after = approved ? "Active" : "Suspended";
  return (
    <div className={styles.detail}>
      <div className={styles.diff}>
        <p className={styles.diffSummary}>
          {entry.actor} {approved ? "approved" : "rejected"} {entry.studentName}&apos;s
          account ({entry.lrn ?? "no LRN"}).
        </p>
        <div className={styles.diffCards}>
          <div className={styles.diffCol}>
            <span className={styles.diffLabel}>Before</span>
            <dl className={styles.diffFields}>
              <div className={styles.diffField}>
                <dt className={styles.diffFieldLabel}>Status</dt>
                <dd className={styles.diffFieldValue}>{before}</dd>
              </div>
            </dl>
          </div>
          <div className={styles.diffArrow} aria-hidden>
            →
          </div>
          <div className={styles.diffCol}>
            <span className={styles.diffLabel}>After</span>
            <dl className={styles.diffFields}>
              <div className={styles.diffField}>
                <dt className={styles.diffFieldLabel}>Status</dt>
                <dd className={styles.diffFieldValue}>{after}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      {entry.reason ? (
        <p className={styles.reasonLine}>
          <strong>Reason:</strong> {entry.reason}
        </p>
      ) : null}
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className={styles.wrap}>
      <Table>
        <TableHeader>
          <TableRow className={styles.headRow}>
            <TableHead className={styles.expandCol} />
            <TableHead className={styles.colStudent}>Student</TableHead>
            <TableHead className={styles.colSection}>Grade / Section</TableHead>
            <TableHead className={styles.colAction}>Action</TableHead>
            <TableHead className={styles.colActor}>Processed by</TableHead>
            <TableHead className={styles.colWhen}>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className={styles.row}>
              <TableCell className={styles.expandCol} />
              <TableCell className={styles.colStudent}><Skeleton className={pageStyles.skelName} /></TableCell>
              <TableCell className={styles.colSection}><Skeleton className={pageStyles.skelCell} /></TableCell>
              <TableCell className={styles.colAction}><Skeleton className={pageStyles.skelLrn} /></TableCell>
              <TableCell className={styles.colActor}><Skeleton className={pageStyles.skelCell} /></TableCell>
              <TableCell className={styles.colWhen}><Skeleton className={pageStyles.skelCell} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
