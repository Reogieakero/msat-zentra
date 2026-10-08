"use client";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
export function VerifyCodeCard({
  sectionName,
  termLabel,
  attCode,
  attCodeError,
  verifyPending,
  onAttCodeChange,
  onVerify,
}: {
  sectionName: string | undefined;
  termLabel: string;
  attCode: string;
  attCodeError: string | null;
  verifyPending: boolean;
  onAttCodeChange: (value: string) => void;
  onVerify: () => void;
}) {
  return (
    <div className={assign.card} aria-label="Verify code for this section">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-col gap-2">
        <p className="text-sm">
          <span className="font-semibold">{sectionName}</span>
          <span className="text-muted-foreground">
            {" "}is outside your advisory — verify your teacher code to mark
            attendance here for {termLabel}.
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Teacher code (e.g. MS-101)…"
            value={attCode}
            onChange={(e) => {
              onAttCodeChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onVerify();
            }}
            aria-label="Attendance teacher code"
            className="text-center uppercase"
          />
          {attCodeError ? (
            <p role="alert" className="text-sm text-destructive">
              {attCodeError}
            </p>
          ) : null}
          <Button onClick={onVerify} disabled={verifyPending}>
            {verifyPending ? (
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
