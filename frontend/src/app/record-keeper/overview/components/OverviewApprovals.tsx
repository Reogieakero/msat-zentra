"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FileStack,
  GraduationCap,
  MoreHorizontal,
  Search,
  ShieldQuestion,
  UserCog,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRecordKeeperOverview } from "./overview-data";
import styles from "./OverviewApprovals.module.css";

const PAGE_SIZE = 5;

interface ActionItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  cta: string;
}

export function OverviewApprovals() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-overview"],
    queryFn: fetchRecordKeeperOverview,
  });

  const actions: ActionItem[] = [
    {
      key: "finals",
      icon: FileSignature,
      title: "Final Grade Approvals",
      count: data?.lockedFinalsAwaiting ?? 0,
      href: "/record-keeper/final-grades",
      cta: "View finals",
    },
    {
      key: "students",
      icon: GraduationCap,
      title: "Pending Students",
      count: data?.pendingStudents.length ?? 0,
      href: "/record-keeper/accounts",
      cta: "Approve enrollments",
    },
    {
      key: "adviser",
      icon: ShieldQuestion,
      title: "Adviser Access",
      count: data?.pendingAdviserAccess ?? 0,
      href: "/record-keeper/adviser-access",
      cta: "Grant access",
    },
    {
      key: "sf10",
      icon: FileStack,
      title: "SF10 Records to Attach",
      count: data?.latestAttachments.length ?? 0,
      href: "/record-keeper/sf10",
      cta: "Process records",
    },
  ];

  const goAccounts = React.useCallback(() => {
    router.push("/record-keeper/accounts");
  }, [router]);

  const pendingStudents = React.useMemo(() => {
    const all = [...(data?.pendingStudents ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => `${s.name} ${s.lrn}`.toLowerCase().includes(q));
  }, [data, query]);

  const total = pendingStudents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = pendingStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            Approvals and follow-ups that need record keeper attention this term.
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search name or LRN…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search pending students"
            />
          </div>
          <Button variant="outline" size="sm" onClick={goAccounts}>
            View all
            <ArrowRight aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.sectionBlock}>
            <div className={styles.actionGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={styles.actionSkel} />
              ))}
            </div>
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load overview figures.</p>
        ) : (
          <>
            <div className={styles.sectionBlock}>
              <div className={styles.actionGrid}>
                {actions.map((a) => {
                  const Icon = a.icon;
                  const empty = a.count === 0;
                  return (
                    <button
                      type="button"
                      key={a.key}
                      className={styles.actionItem}
                      onClick={() => router.push(a.href)}
                      aria-label={
                        empty ? `${a.title}: all caught up` : `${a.title}: ${a.count} pending`
                      }
                    >
                      <span className={styles.actionHead}>
                        <span className={styles.actionIcon}>
                          <Icon className={styles.actionIconSvg} aria-hidden />
                        </span>
                        <span className={styles.actionCount}>{a.count}</span>
                      </span>
                      <span className={styles.actionTitle}>{a.title}</span>
                      <span className={styles.actionCta}>
                        {empty ? "View" : a.cta}
                        <ArrowRight className={styles.actionCtaIcon} aria-hidden />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className={styles.footnote}>
                <UserCog className={styles.footnoteIcon} aria-hidden />
                {data?.pendingAccounts ?? 0} pending account request
                {(data?.pendingAccounts ?? 0) !== 1 ? "s" : ""} across the grade band.
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Parent / Guardian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.empty}>
                      {query.trim()
                        ? `No pending students match "${query}".`
                        : "All caught up — no pending student enrollments in the G7–10 band."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((s) => (
                    <TableRow key={s.lrn} className={styles.clickableRow} onClick={goAccounts}>
                      <TableCell>
                        <div className={styles.studentCell}>
                          <span className={styles.studentName}>{s.name}</span>
                          <span className={styles.studentLrn}>{s.lrn}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.gradeTag}>{s.grade}</span>
                      </TableCell>
                      <TableCell className={styles.parentCell}>{s.parent}</TableCell>
                      <TableCell>
                        <Badge variant="warning" className={styles.statusBadge}>
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className={styles.menuCell}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${s.name}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={goAccounts}>View details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
      <CardFooter className={styles.footer}>
        <span className={styles.footerInfo}>
          {total > 0 ? `${start}–${end} of ${total}` : "0 of 0"}
        </span>
        <div className={styles.footerActions}>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1 || total === 0}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages || total === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}