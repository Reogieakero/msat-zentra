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
import { TeacherCodeClaim } from "./TeacherCodeClaim";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface TermAccessCardProps {
  linkedName: string | null;
  termLabel: string;
  claimTitle: string;
  claimDescription: string;
  successTitle: string;
  successDescription: string;
}

export function TermAccessCard({
  linkedName,
  termLabel,
  claimTitle,
  claimDescription,
  successTitle,
  successDescription,
}: TermAccessCardProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: async (teacherCode: string) => {
      const { data } = await apiClient.post(
        "/api/teacher/schedule/teachers/verify-attendance",
        { code: teacherCode },
      );
      return data;
    },
    onSuccess: () => {
      setCode("");
      setCodeError(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      toast.success({ title: successTitle, description: successDescription });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Could not verify teacher code.");
      setCodeError(message);
      toast.error({ title: "Could not verify code", description: message });
    },
  });

  if (!linkedName) {
    return <TeacherCodeClaim title={claimTitle} description={claimDescription} />;
  }

  const handleVerify = () => {
    if (verify.isPending) return;
    if (!code.trim()) {
      setCodeError("Enter your teacher code to open this term.");
      return;
    }
    setCodeError(null);
    verify.mutate(code.trim());
  };

  return (
    <div className={`${kanbanStyles.column} mx-auto w-full max-w-md`}>
      <KanbanBoard
        title={`Enter ${termLabel} with your code`}
        icon={
          <span className="text-amber-500" aria-hidden>
            <KeyRound size={14} />
          </span>
        }
        description={`Linked as ${linkedName} — type your teacher code to unlock this term's workspace. Your subjects appear here once the master teacher schedules them; a code alone never creates classes.`}
        ariaLabel={`Enter ${termLabel} with teacher code`}
      >
        <div className="flex flex-col px-1 py-1">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="TEACHER CODE (E.G. MS-101)..."
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleVerify();
              }}
              aria-label="Teacher code"
              className="h-8 min-w-0 flex-1 rounded-lg text-center uppercase"
            />
            <Button
              onClick={handleVerify}
              disabled={verify.isPending}
              className="h-8 shrink-0 rounded-lg bg-black px-4 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {verify.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Verifying…</span>
                </>
              ) : (
                "Verify code"
              )}
            </Button>
          </div>
          {codeError ? (
            <p role="alert" className="mt-2 text-center text-sm text-destructive">
              {codeError}
            </p>
          ) : null}
        </div>
      </KanbanBoard>
    </div>
  );
}
