"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, FileText, Loader2, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { AmberRectPill } from "../../../classes/components/UnlinkCodeDialog";
import { format } from "date-fns";
import { COMPONENT_LABELS, COMPONENT_NAMES } from "@/services/teacher/grading.compute";
import { useDeleteAssessmentSave } from "./delete-assessment-save-context";
import type {
  ClassAssessment,
  ClassComponent,
  ClassStudent,
  ComponentType,
} from "@/services/teacher/grading.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AssessmentList.module.css";

const DOT: Record<string, string> = {
  WRITTEN_WORK: "bg-blue-500",
  PERFORMANCE_TASK: "bg-amber-500",
  EXAM: "bg-red-500",
};

const CATEGORY_COLOR: Record<string, string> = {
  WRITTEN_WORK: "#3b82f6",
  PERFORMANCE_TASK: "#f59e0b",
  EXAM: "#ef4444",
};

const CATEGORY_ICON = {
  WRITTEN_WORK: PenLine,
  PERFORMANCE_TASK: ClipboardList,
  EXAM: FileText,
} as const;

type Props = {
  students: ClassStudent[];
  components: ClassComponent[];
  query: string;
  onSelect: (category: ComponentType, assessmentId: string) => void;
  onDeleted: (assessmentId: string) => void;
};

export function AssessmentList({ students, components, query, onSelect, onDeleted }: Props) {
  const [pendingDelete, setPendingDelete] = React.useState<{
    assessment: ClassAssessment;
    type: ComponentType;
  } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const { deleteAssessmentFlow } = useDeleteAssessmentSave();

  const groups = components.map((c) => ({
    type: c.type,
    assessments: [...c.assessments]
      .filter((a) =>
        a.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort(
        (a, b) => +new Date(b.dateGiven) - +new Date(a.dateGiven),
      ),
  }));
  const total = groups.reduce((n, g) => n + g.assessments.length, 0);
  const unfilteredTotal = components.reduce((n, c) => n + c.assessments.length, 0);

  const scoredOf = (a: ClassAssessment) =>
    students.filter((s) => a.scores[s.id] != null).length;

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { assessment, type } = pendingDelete;
    const { id } = assessment;
    setPendingDelete(null);
    setDeletingId(id);
    const given = new Date(assessment.dateGiven);
    const pills = [
      COMPONENT_LABELS[type],
      `${assessment.maxScore} max`,
      Number.isNaN(given.getTime()) ? assessment.dateGiven : format(given, "MM/dd/yyyy"),
    ];
    // The dock opens this tick inside the provider and keeps running even
    // if the user navigates away mid-flight.
    const result = await deleteAssessmentFlow(id, { title: assessment.title, pills });
    setDeletingId(null);
    if (result.ok) onDeleted(id);
  };

  if (unfilteredTotal === 0) {
    return (
      <div className={`${assign.card} mx-auto w-full max-w-md`}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-col items-center gap-2 py-8 text-center">
          <p className="font-semibold">No assessments yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Use the Add assessment card to create your first quiz, activity, or exam.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-w-0 flex-1" aria-label="Select assessment">
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No assessments match &quot;{query.trim()}&quot;.
        </p>
      ) : null}
      <div className="mt-2 min-w-0">
      <div className="flex flex-col gap-4">
      {groups.map((g, secIdx) =>
        g.assessments.length === 0 ? null : (
          <section
            key={g.type}
            aria-label={COMPONENT_NAMES[g.type]}
            className={`${styles.section} min-w-0`}
            style={{ animationDelay: `${secIdx * 70}ms` }}
          >
            <div className="flex items-center gap-2 px-1 pb-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[g.type]}`} aria-hidden />
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{COMPONENT_NAMES[g.type]}</h2>
              <Badge variant="secondary" className="ml-auto">
                {g.assessments.length}
              </Badge>
            </div>
            <ul className={`${styles.row} flex min-w-0 flex-row gap-2 overflow-x-auto pb-2`}>
              {g.assessments.map((a, cardIdx) => {
                const scored = scoredOf(a);
                const busy = deletingId === a.id;
                const pct = students.length > 0 ? Math.round((scored / students.length) * 100) : 0;
                return (
                  <li
                    key={a.id}
                    className={`w-80 max-w-full shrink-0 ${styles.item}`}
                    style={{ animationDelay: `${secIdx * 70 + Math.min(cardIdx, 8) * 35}ms` }}
                  >
                    <KanbanBoard
                      title={a.title}
                      icon={(() => {
                        const Icon =
                          CATEGORY_ICON[g.type as keyof typeof CATEGORY_ICON] ?? ClipboardList;
                        return (
                          <span
                            aria-hidden
                            style={{ color: CATEGORY_COLOR[g.type] ?? "#f59e0b" }}
                          >
                            <Icon size={14} />
                          </span>
                        );
                      })()}
                      count={`${a.maxScore} max`}
                      style={{
                        borderColor: `color-mix(in oklch, ${CATEGORY_COLOR[g.type] ?? "#f59e0b"} 45%, transparent)`,
                        background: `color-mix(in oklch, ${CATEGORY_COLOR[g.type] ?? "#f59e0b"} 7%, transparent)`,
                      }}
                      description={
                        <span className="flex flex-wrap items-center gap-1">
                          <AmberRectPill>Added {a.createdAt}</AmberRectPill>
                          <AmberRectPill>
                            {scored}/{students.length} scored
                          </AmberRectPill>
                        </span>
                      }
                      footer={
                        <div className="flex items-center justify-between gap-2 px-1 pb-1">
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ assessment: a, type: g.type })}
                            disabled={busy}
                            aria-label={`Delete ${a.title}`}
                            title="Delete assessment"
                            className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-muted hover:text-red-500"
                          >
                            {busy ? (
                              <Loader2 size={14} className="animate-spin" aria-hidden />
                            ) : (
                              <Trash2 size={14} aria-hidden />
                            )}
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                            onClick={() => onSelect(g.type, a.id)}
                            aria-label={`Encode scores for ${a.title}`}
                          >
                            Encode scores
                          </Button>
                        </div>
                      }
                    >
                      <div className="px-1" aria-hidden="true">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </KanbanBoard>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
      </div>
      </div>
    </div>

      {pendingDelete ? (
        <DeleteAssessmentOverlay
          title={pendingDelete.assessment.title}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

function DeleteAssessmentOverlay({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Portal to document.body so no transformed ancestor can hijack this
  // fixed overlay as its containing block. Mounted flag guards prerender.
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete assessment?"
        className="w-full max-w-sm"
      >
        <KanbanBoard
          title="Delete assessment?"
          icon={<Trash2 size={14} className="text-red-500" aria-hidden />}
          description={`"${title}" and all of its encoded scores will be permanently removed.`}
          footer={
            <div className="flex justify-end gap-2 px-1 pb-1">
              <Button
                type="button"
                size="sm"
                className="h-6 bg-red-500 px-3 text-xs text-white hover:bg-red-600"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 bg-red-500 px-3 text-xs text-white hover:bg-red-600"
                onClick={onConfirm}
              >
                Delete
              </Button>
            </div>
          }
          className="bg-card shadow-2xl"
        >
          <p className="px-1 text-xs text-muted-foreground">
            Encoded scores for this assessment will be removed as well. This
            cannot be undone.
          </p>
        </KanbanBoard>
      </div>
    </div>,
    document.body,
  );
}
