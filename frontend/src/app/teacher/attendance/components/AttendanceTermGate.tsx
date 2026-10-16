"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { AmberRectPill } from "@/app/teacher/classes/components/UnlinkCodeDialog";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import styles from "./attendance-sheet.module.css";

function GateShell({
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
    <div className={emptyStyles.emptyWrap}>
      <div className={`${kanbanStyles.column} mx-auto w-full max-w-md`}>
        <KanbanBoard
          title={title}
          icon={
            <span className="text-amber-500" aria-hidden>
              <KeyRound size={14} />
            </span>
          }
          actions={
            <span className="flex items-center gap-1.5">
              {termLabel
                .split("·")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => (
                  <AmberRectPill key={part}>{part}</AmberRectPill>
                ))}
            </span>
          }
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
  );
}

export function AttendanceTermGate({ termLabel }: { termLabel: string }) {
  return (
    <section className={styles.page}>
      <div className={styles.gateBody}>
        <GateShell
          title="Enter term"
          termLabel={termLabel}
          description="Your subjects will appear here only after you enter this term's code on the classes page. Without entering the term, nothing is displayed here."
          actionLabel="Go to classes to enter code"
        />
      </div>
    </section>
  );
}

export function AttendanceLinkGate({ termLabel }: { termLabel: string }) {
  return (
    <section className={styles.page}>
      <div className={styles.gateBody}>
        <GateShell
          title="Link code"
          termLabel={termLabel}
          description="Your subjects will appear here only after you link your teacher code on the classes page. Without a link code, nothing is displayed here."
          actionLabel="Go to classes to link code"
        />
      </div>
    </section>
  );
}
