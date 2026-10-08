"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { ChevronDown, Loader2, SearchIcon, Trash2 } from "lucide-react";
import { CardModal } from "@/components/ui/CardModal";
import { Button } from "@/components/ui/button";
import { COMPONENT_NAMES } from "@/services/teacher/grading.compute";
import { deleteAssessment } from "@/services/teacher/grading.service";
import type {
  ClassAssessment,
  ClassComponent,
  ClassStudent,
  ComponentType,
} from "@/services/teacher/grading.types";
import { sileo } from "@/components/ui/sonner";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import scrollStyles from "@/app/teacher/schedule/schedule-empty.module.css";

const DOT: Record<string, string> = {
  WRITTEN_WORK: "bg-blue-500",
  PERFORMANCE_TASK: "bg-amber-500",
  EXAM: "bg-red-500",
};

type Props = {
  students: ClassStudent[];
  components: ClassComponent[];
  onSelect: (category: ComponentType, assessmentId: string) => void;
  onDeleted: (assessmentId: string) => void;
};

export function AssessmentList({ students, components, onSelect, onDeleted }: Props) {
  const [pendingDelete, setPendingDelete] = React.useState<ClassAssessment | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

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

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const updateScrollHint = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollDown(false);
      return;
    }
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);
  React.useEffect(() => {
    updateScrollHint();
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [updateScrollHint, total, query]);

  const scoredOf = (a: ClassAssessment) =>
    students.filter((s) => a.scores[s.id] != null).length;

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { id, title } = pendingDelete;
    setPendingDelete(null);
    setDeletingId(id);
    try {
      await deleteAssessment(id);
      sileo.success({ title: "Assessment deleted", description: `"${title}" and its scores were removed.` });
      onDeleted(id);
    } catch {
      sileo.error({ title: "Could not delete assessment", description: "Try again." });
    } finally {
      setDeletingId(null);
    }
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
    <div className="flex min-h-[50vh] flex-1 items-center justify-center">
    <div className={`${assign.card} relative w-full max-w-lg min-w-0`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <p className="relative text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Select assessment
      </p>
      <InputGroup className="relative max-w-40">
        <InputGroupInput
          placeholder="Search assessments..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search assessments"
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      {total === 0 ? (
        <p className="relative text-sm text-muted-foreground">
          No assessments match &quot;{query.trim()}&quot;.
        </p>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={updateScrollHint}
        className={`relative max-h-[55vh] min-w-0 overflow-y-auto ${scrollStyles.noScrollbar}`}
      >
      {groups.map((g) =>
        g.assessments.length === 0 ? null : (
          <div key={g.type} className={`${assign.card} mb-3 last:mb-0`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[g.type]}`} aria-hidden />
              <h2 className="font-semibold">{COMPONENT_NAMES[g.type]}</h2>
              <Badge variant="secondary" className="ml-auto">
                {g.assessments.length}
              </Badge>
            </div>
            <ul className="relative flex flex-col gap-2">
              {g.assessments.map((a) => {
                const scored = scoredOf(a);
                const busy = deletingId === a.id;
                return (
                  <li key={a.id} className="flex min-w-0 items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(g.type, a.id)}
                      aria-label={`Encode scores for ${a.title}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-input bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{a.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          Added {a.createdAt} · {scored}/{students.length} scored
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-base leading-none font-bold tabular-nums">
                          {a.maxScore}
                        </span>
                        <span className="text-[11px] text-muted-foreground">max</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(a)}
                      disabled={busy}
                      aria-label={`Delete ${a.title}`}
                      title="Delete assessment"
                      className="shrink-0 self-center rounded-md p-1.5 transition-colors hover:bg-muted hover:text-red-500"
                    >
                      {busy ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                      ) : (
                        <Trash2 size={16} aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
      </div>
      {canScrollDown ? (
        <button
          type="button"
          onClick={() =>
            scrollRef.current?.scrollBy({ top: 240, behavior: "smooth" })
          }
          aria-label="Scroll down for more assessments"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium shadow-lg transition-colors hover:border-primary"
        >
          <ChevronDown size={14} aria-hidden="true" />
          Scroll down
        </button>
      ) : null}
    </div>
    </div>

      <CardModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Delete assessment?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and all of its encoded scores will be permanently removed. This cannot be undone.`
            : "This assessment and all of its encoded scores will be permanently removed."
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setPendingDelete(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>
      </CardModal>
    </>
  );
}
