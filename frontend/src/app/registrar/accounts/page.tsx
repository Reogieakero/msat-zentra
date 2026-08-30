"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingStudentsTable } from "./components/PendingStudentsTable";
import { StudentProfileCard } from "./components/StudentProfileCard";
import { AccountsBreakdown } from "./components/AccountsBreakdown";
import type {
  PendingStudent,
  PendingStudentsResponse,
  AccountBreakdown,
} from "./components/types";
import { apiClient } from "@/lib/api/client";
import styles from "./accounts.module.css";

export default function AccountApprovalsPage() {
  const [students, setStudents] = React.useState<PendingStudent[]>([]);
  const [breakdown, setBreakdown] = React.useState<AccountBreakdown[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<PendingStudentsResponse>("/api/auth/pending", {
        params: { role: "student" },
      }),
      apiClient.get<{ data: AccountBreakdown[] }>("/api/registrar/account-breakdown"),
    ])
      .then(([pendingRes, breakdownRes]) => {
        if (cancelled) return;
        setStudents(pendingRes.data.students);
        setBreakdown(breakdownRes.data.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status
            ? `Failed to load account approvals (HTTP ${status})`
            : "Failed to load account approvals",
        );
        console.error("[/api/auth/pending] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleActed = React.useCallback(
    (id: string, approved: boolean, reason?: string) => {
      setActing(id);
      const endpoint = approved ? "approve" : "reject";
      apiClient
        .post(
          `/api/auth/${endpoint}/${id}`,
          approved ? {} : { reason: reason ?? "Rejected by registrar" },
        )
        .then(() => {
          setStudents((prev) => prev.filter((s) => s.id !== id));
          setSelectedId((current) => (current === id ? null : current));
        })
        .catch((err: unknown) => {
          console.error(`[/api/auth/${endpoint}/${id}] failed:`, err);
        })
        .finally(() => setActing(null));
    },
    [],
  );

  const selected = students.find((s) => s.id === selectedId) ?? null;

  return (
    <section className={styles.page}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.layout} data-selected={selected ? "true" : "false"}>
        <div className={styles.tableCol}>
          <h1 className={styles.colTitle}>Account Approvals</h1>
          <PendingStudentsTable
            students={students}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />
        </div>

        <div className={styles.main}>
          {loading ? (
            <StudentProfileSkeleton />
          ) : (
            <StudentProfileCard
              student={selected}
              acting={acting}
              onActed={handleActed}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      <AccountsBreakdown data={breakdown} loading={loading} />
    </section>
  );
}

function StudentProfileSkeleton() {
  return (
    <div className={styles.profileSkeleton}>
      <Skeleton className={styles.skelAvatar} />
      <div className={styles.skelLines}>
        <Skeleton className={styles.skelLineLg} />
        <Skeleton className={styles.skelLineSm} />
      </div>
      <Skeleton className={styles.skelBlock} />
      <Skeleton className={styles.skelBlock} />
      <div className={styles.skelActions}>
        <Skeleton className={styles.skelBtn} />
        <Skeleton className={styles.skelBtnGhost} />
      </div>
    </div>
  );
}
