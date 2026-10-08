"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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
      <div className={assign.card} style={{ width: "100%", maxWidth: "28rem" }}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-col items-center text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
            <KeyRound size={32} className="text-primary" />
          </span>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex w-full flex-col gap-2">
            <Input
              placeholder="Teacher code (e.g. MS-101)…"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setClaimError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleClaim();
              }}
              aria-label="Teacher code"
              className="text-center uppercase"
            />
            {claimError ? (
              <p role="alert" className="text-sm text-destructive">
                {claimError}
              </p>
            ) : null}
            <Button onClick={handleClaim} disabled={claim.isPending}>
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
        </div>
      </div>
    </div>
  );
}
