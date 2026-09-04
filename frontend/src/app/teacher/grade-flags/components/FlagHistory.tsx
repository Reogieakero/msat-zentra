"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare, Paperclip } from "lucide-react";
import { FlagDetailDialog } from "./FlagDetailDialog";
import { ResolveFlagDialog } from "./ResolveFlagDialog";
import {
  STATUS_LABELS,
  fetchFlags,
  formatAge,
  type FlagStatus,
  type GradeFlagRow,
} from "./grade-flags-data";
import { initialsOfTeacher } from "./history-helpers";
import styles from "./FlagHistory.module.css";

type Mode = "raised-by-me" | "against-me" | "advisees";
type StatusFilter = "all" | FlagStatus;

const STATUS_VARIANTS = {
  open: "warning",
  escalated: "destructive",
  resolved: "success",
} as const;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
] as const;

const STATUS_PROGRESS: Record<FlagStatus, number> = {
  open: 33,
  escalated: 67,
  resolved: 100,
};

const MODE_HINTS: Record<Mode, string> = {
  "raised-by-me": "Flags you filed, grouped by the teacher you filed each one against.",
  "against-me": "Flags others filed on your gradebook — only you can resolve these.",
  advisees: "Flags on your advisees' grades, including gradebooks owned by other teachers.",
};

interface FlagHistoryProps {
  onBack: () => void;
}

function groupFlags(rows: GradeFlagRow[], by: "owner" | "raiser") {
  const groups = new Map<string, GradeFlagRow[]>();
  for (const row of rows) {
    const key = by === "owner" ? row.owner?.fullName ?? "Unassigned" : row.raisedBy.fullName;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([teacher, flags], i) => ({
    id: `col-${i}`,
    teacher,
    flags,
  }));
}

export function FlagHistory({ onBack }: FlagHistoryProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("raised-by-me");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<GradeFlagRow | null>(null);
  const [resolving, setResolving] = useState<GradeFlagRow | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["grade-flags"] });
  };

  const mineQuery = useQuery({
    queryKey: ["grade-flags", "mine"],
    queryFn: () => fetchFlags("mine"),
  });
  const againstQuery = useQuery({
    queryKey: ["grade-flags", "against-me"],
    queryFn: () => fetchFlags("against-me"),
  });
  const adviseeQuery = useQuery({
    queryKey: ["grade-flags", "advisees"],
    queryFn: () => fetchFlags("advisees"),
    retry: false,
  });

  const isAdviser = adviseeQuery.isSuccess;
  const loading = mineQuery.isPending || againstQuery.isPending;
  const loadError = mineQuery.isError || againstQuery.isError;

  const rows = useMemo(() => {
    const source =
      mode === "raised-by-me"
        ? mineQuery.data ?? []
        : mode === "against-me"
          ? againstQuery.data ?? []
          : adviseeQuery.data ?? [];
    const groupBy = mode === "against-me" ? "raiser" : "owner";
    return groupFlags(
      source.filter((f) => statusFilter === "all" || f.status === statusFilter),
      groupBy
    );
  }, [mode, statusFilter, mineQuery.data, againstQuery.data, adviseeQuery.data]);

  const total =
    mode === "raised-by-me"
      ? mineQuery.data?.length ?? 0
      : mode === "against-me"
        ? againstQuery.data?.length ?? 0
        : adviseeQuery.data?.length ?? 0;
  const shown = rows.reduce((n, c) => n + c.flags.length, 0);

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Back to raise"
        >
          <ChevronLeft aria-hidden />
          Back
        </Button>
        <h2 className={styles.boardTitle}>Flag history</h2>
        <p className={styles.boardCount}>
          {loading ? "Loading…" : shown === total ? `${total} flags` : `${shown} of ${total} flags`}
        </p>
        <div className={styles.filters}>
          <div className={styles.modeToggle} role="group" aria-label="History scope">
            <Button
              type="button"
              size="sm"
              variant={mode === "raised-by-me" ? "default" : "ghost"}
              onClick={() => setMode("raised-by-me")}
            >
              Raised by me
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "against-me" ? "default" : "ghost"}
              onClick={() => setMode("against-me")}
            >
              Against me
            </Button>
            {isAdviser ? (
              <Button
                type="button"
                size="sm"
                variant={mode === "advisees" ? "default" : "ghost"}
                onClick={() => setMode("advisees")}
              >
                Advisees
              </Button>
            ) : null}
          </div>
          <div className={styles.statusFilter} role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={statusFilter === f.value ? "default" : "ghost"}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <p className={styles.modeHint}>{MODE_HINTS[mode]}</p>
      </header>
      <hr className={styles.divider} />

      {loading ? (
        <p className={styles.empty}>Loading flag history…</p>
      ) : loadError ? (
        <p className={styles.empty}>Could not load flag history. Try again.</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          {total === 0 ? "No flags here yet — file your first one from Raise." : "Nothing matches this filter."}
        </p>
      ) : (
        <div className={styles.columns}>
          {rows.map((col) => (
            <section key={col.id} className={styles.column} aria-label={`${col.teacher} flags`}>
              <header className={styles.columnHead}>
                <span className={styles.teacherAvatar} aria-hidden>
                  {initialsOfTeacher(col.teacher)}
                </span>
                <span className={styles.teacherName}>{col.teacher}</span>
                <span className={styles.columnCount}>{col.flags.length}</span>
              </header>

              <ul className={styles.cards}>
                {col.flags.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={styles.flagCard}
                      onClick={() => setSelected(f)}
                      aria-label={`${f.student.name}, ${f.reason}, ${STATUS_LABELS[f.status]}`}
                    >
                      <span className={styles.cardTop}>
                        <span className={styles.cardTitle}>{f.student.name}</span>
                        <Badge variant={STATUS_VARIANTS[f.status]}>
                          {STATUS_LABELS[f.status]}
                        </Badge>
                      </span>
                      <span className={styles.cardSub}>
                        {f.subject.name} · {f.section.name} · Term {f.term.termNumber}
                      </span>
                      <span className={styles.cardRaiser}>
                        <span className={styles.raiserAvatar} aria-hidden>
                          {initialsOfTeacher(f.raisedBy.fullName)}
                        </span>
                        Raised by {f.raisedBy.fullName}
                      </span>
                      {f.note ? <span className={styles.cardNote}>{f.note}</span> : null}
                      <span
                        className={styles.cardProgress}
                        role="progressbar"
                        aria-valuenow={STATUS_PROGRESS[f.status]}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${STATUS_PROGRESS[f.status]}% resolved`}
                      >
                        <span
                          className={styles.cardProgressFill}
                          style={{ width: `${STATUS_PROGRESS[f.status]}%` }}
                        />
                      </span>
                      <span className={styles.cardFoot}>
                        <span className={styles.cardMeta}>
                          <MessageSquare className={styles.metaIcon} aria-hidden />
                          {f.status === "resolved" ? "Resolved" : formatAge(f.ageDays)}
                        </span>
                        <span className={styles.cardMeta}>
                          <Paperclip className={styles.metaIcon} aria-hidden />
                          {new Date(f.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FlagDetailDialog
        flag={selected}
        onClose={() => setSelected(null)}
        onResolve={mode === "against-me" ? setResolving : undefined}
      />
      <ResolveFlagDialog
        flag={resolving}
        onClose={() => setResolving(null)}
        onResolved={() => {
          setResolving(null);
          setSelected(null);
          refresh();
        }}
      />
    </div>
  );
}
