"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ClipboardList, KeyRound } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { AmberRectPill } from "../classes/components/UnlinkCodeDialog";
import { useTeacherOverviewGradebook } from "@/services/teacher/overview.service";
import { GradebookCards } from "./components/GradebookCards";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import styles from "./components/gradebook.module.css";

function TermPills({ termLabel }: { termLabel: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {termLabel
        .split("·")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (
          <AmberRectPill key={part}>{part}</AmberRectPill>
        ))}
    </span>
  );
}

function GradebookGateCard({
  title,
  termLabel,
  description,
  actionLabel,
}: {
  title: string;
  termLabel: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <section className={styles.page} aria-label="Gradebook">
      <div className={emptyStyles.emptyWrap}>
        <div className={`${kanbanStyles.column} mx-auto w-full max-w-md`}>
          <KanbanBoard
            title={title}
            icon={
              <span className="text-amber-500" aria-hidden>
                <KeyRound size={14} />
              </span>
            }
            actions={<TermPills termLabel={termLabel} />}
            description={description}
          >
            <div className="flex justify-end px-1 pb-1">
              <Button
                asChild
                size="sm"
                className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <Link href="/teacher/classes">{actionLabel}</Link>
              </Button>
            </div>
          </KanbanBoard>
        </div>
      </div>
    </section>
  );
}

export default function TeacherGradebookPage() {

  const gradebook = useTeacherOverviewGradebook();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  // Same shared-code source as the classes page: subjects only display
  // when this login is linked AND this term is entered there.
  const meQuery = useQuery({
    queryKey: ["teacher-schedule-me", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        teacherName: { id: string; name: string; code: string | null } | null;
        termGrant: { via: string; attendanceVerified: boolean } | null;
      }>("/api/teacher/schedule/teachers/me");
      return data;
    },
  });

  const linked = meQuery.data?.teacherName ?? null;
  const termGrant = meQuery.data?.termGrant ?? null;
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";

  if (gradebook.isPending || meQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading gradebook">
        <div className={styles.skelGrid} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skelCard}>
              <Skeleton className={styles.skelSubject} />
              <Skeleton className={styles.skelMeta} />
              <div className={styles.skelStats}>
                {[0, 1].map((s) => (
                  <div key={s} className={styles.skelStatCol}>
                    <Skeleton className={styles.skelStatValue} />
                    <Skeleton className={styles.skelStatLabel} />
                  </div>
                ))}
              </div>
              <Skeleton className={styles.skelBar} />
              <Skeleton className={styles.skelProgressLabel} />
              <div className={styles.skelFoot}>
                <Skeleton className={styles.skelBtn} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (gradebook.isError || !gradebook.data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your gradebook. Check your connection and try again.</p>
      </section>
    );
  }

  // No link code on the classes page => no display on the grading page.
  // Every teacher — master included — must link a code first.
  if (!linked) {
    return (
      <GradebookGateCard
        title="Link code"
        termLabel={termLabel}
        description="Your subjects will appear here only after you link your teacher code on the classes page. Without a link code, nothing is displayed here."
        actionLabel="Go to classes to link code"
      />
    );
  }

  // Linked but this term not entered on the classes page => still no display.
  // Code entry lives only on /teacher/classes; this page just links there.
  if (!termGrant) {
    return (
      <GradebookGateCard
        title="Enter term"
        termLabel={termLabel}
        description="Your subjects will appear here only after you enter this term's code on the classes page. Without entering the term, nothing is displayed here."
        actionLabel="Go to classes to enter code"
      />
    );
  }

  if (gradebook.data.classes.length === 0) {
    return (
      <section className={styles.page} aria-label="Gradebook">
        <TeacherEmptyCard
          centered
          icon={ClipboardList}
          title="No classes assigned yet"
          hint="Link your teacher code on the classes page or ask your registrar to assign your subjects and sections first — only your linked subjects will appear here."
          label="Gradebook"
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gradebook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {gradebook.data.classes.length === 1
            ? "1 subject"
            : `${gradebook.data.classes.length} subjects`}{" "}
          for this term — open a workspace to encode scores.
        </p>
      </div>
      <GradebookCards
        classes={gradebook.data.classes}
        assessments={gradebook.data.assessments}
        standings={gradebook.data.standings}
      />
    </section>
  );
}
