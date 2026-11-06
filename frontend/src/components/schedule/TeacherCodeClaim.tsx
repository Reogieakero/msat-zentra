"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface TeacherCodeClaimProps {
  title: string;
  description: string;
}

export function TeacherCodeClaim({ title, description }: TeacherCodeClaimProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: async (teacherCode: string) => {
      const { data } = await apiClient.post<{
        teacherName: { id: string; name: string; code: string | null };
      }>("/api/teacher/schedule/teachers/claim", { code: teacherCode });
      return data;
    },
    onSuccess: (data) => {
      setCode("");
      setClaimError(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-my-slots"] });
      // Merged entry: linking also entered the term, so refresh the
      // term-gated pages (classes, grading, attendance) together.
      void queryClient.invalidateQueries({ queryKey: ["teacher-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-overview-gradebook"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-overview-secondary"] });
      void queryClient.invalidateQueries({ queryKey: ["offered-subjects"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-section-roster"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
      toast.success({
        title: "Teacher code linked",
        description: `Your classes now follow ${data.teacherName.name}'s scheduled subjects and timeslots.`,
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to link teacher code.");
      setClaimError(message);
      toast.error({ title: "Could not link code", description: message });
    },
  });

  const handleClaim = () => {
    if (claim.isPending) return;
    if (!code.trim()) {
      setClaimError("Enter the code from your teacher list entry (e.g. MS-101).");
      return;
    }
    setClaimError(null);
    claim.mutate(code.trim());
  };

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
          description={description}
        >
          <div className="flex flex-col px-1 py-1">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="TEACHER CODE (E.G. MS-101)..."
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setClaimError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleClaim();
                }}
                aria-label="Teacher code"
                className="h-6 min-w-0 flex-1 rounded-lg text-center text-xs uppercase placeholder:text-[12px]"
              />
              <Button
                onClick={handleClaim}
                disabled={claim.isPending}
                className="h-6 shrink-0 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                {claim.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                    <span aria-live="polite">Linking…</span>
                  </>
                ) : (
                  "Link code"
                )}
              </Button>
            </div>
            {claimError ? (
              <p role="alert" className="mt-2 text-center text-sm text-destructive">
                {claimError}
              </p>
            ) : null}
          </div>
        </KanbanBoard>
      </div>
    </div>
  );
}
