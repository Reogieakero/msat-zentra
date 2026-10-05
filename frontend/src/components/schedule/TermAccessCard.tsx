"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { TeacherCodeClaim } from "./TeacherCodeClaim";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface TermAccessCardProps {
  /** Linked teacher-list name, or null when this login has no link (this is
      also the Master Teacher path — verify would 409 for them, so they get
      the link-code claim instead). */
  linkedName: string | null;
  termLabel: string;
  /** Claim-card copy for the unlinked path. */
  claimTitle: string;
  claimDescription: string;
  /** Toast copy for a successful term verify. */
  successTitle: string;
  successDescription: string;
}

/* Empty-state code card shared by My Classes and Attendance. Unlinked logins
   (including the Master Teacher, who never links through the gates) get the
   link-code claim; linked logins get the per-term verify-code input that
   records this term's grant. Entering a code only unlocks the term
   workspace — timetable slots themselves still come from the master
   teacher's scheduling, which the helper text says outright. */
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
    <div className={assign.card} style={{ width: "100%", maxWidth: "28rem" }} aria-label={`Enter ${termLabel} with teacher code`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-col items-center text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
          <KeyRound size={32} className="text-primary" />
        </span>
        <h3 className="text-lg font-semibold">Enter {termLabel} with your code</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Linked as {linkedName} — type your teacher code to unlock this term&apos;s
          workspace. Your subjects appear here once the master teacher schedules
          them; a code alone never creates classes.
        </p>
        <div className="mt-4 flex w-full flex-col gap-2">
          <Input
            placeholder="Teacher code (e.g. MS-101)…"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleVerify();
            }}
            aria-label="Teacher code"
            className="text-center uppercase"
          />
          {codeError ? (
            <p role="alert" className="text-sm text-destructive">
              {codeError}
            </p>
          ) : null}
          <Button onClick={handleVerify} disabled={verify.isPending}>
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
      </div>
    </div>
  );
}
