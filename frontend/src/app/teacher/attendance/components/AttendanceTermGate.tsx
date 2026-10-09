"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import styles from "./attendance-sheet.module.css";

export function AttendanceTermGate({
  termLabel,
  isAdviser,
  sectionName,
  showCodeVerify,
  attCode,
  attCodeError,
  verifyPending,
  grantPending,
  onAttCodeChange,
  onShowCodeVerify,
  onBackToAdviser,
  onVerify,
  onGrantTap,
}: {
  termLabel: string;
  isAdviser: boolean;
  sectionName: string | null;
  showCodeVerify: boolean;
  attCode: string;
  attCodeError: string | null;
  verifyPending: boolean;
  grantPending: boolean;
  onAttCodeChange: (value: string) => void;
  onShowCodeVerify: (show: boolean) => void;
  onBackToAdviser: () => void;
  onVerify: () => void;
  onGrantTap: () => void;
}) {
  return (
    <section className={styles.page}>
      <div className={styles.gateBody}>
        <div className={emptyStyles.emptyWrap}>
          <div className={assign.card} style={{ width: "100%", maxWidth: "28rem" }}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-col items-center text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <KeyRound size={24} className="text-primary" />
              </span>
              <h3 className="text-lg font-semibold">Enter {termLabel}</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {isAdviser
                  ? `You advise ${sectionName ?? "a section"} — continue as adviser to open per-subject attendance for ${termLabel}, or verify with your teacher code instead.`
                  : `Enter the same teacher code you linked on My Classes to open per-subject attendance for ${termLabel}. Codes never carry across terms.`}
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                {isAdviser && !showCodeVerify ? (
                  <>
                    <Button onClick={onGrantTap} disabled={grantPending}>
                      {grantPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          <span aria-live="polite">Entering…</span>
                        </>
                      ) : (
                        "Continue as adviser"
                      )}
                    </Button>
                    <Button variant="ghost" onClick={() => onShowCodeVerify(true)}>
                      Verify with teacher code instead
                    </Button>
                  </>
                ) : (
                  <>
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
                    {isAdviser ? (
                      <Button variant="ghost" onClick={onBackToAdviser}>
                        Back to adviser entry
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
