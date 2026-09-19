"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { SessionDatePicker } from "@/app/guidance/referrals/components/session-datetime-picker";
import { ClinicDatePicker, ClinicTimePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import type { GuidanceAdmCase } from "@/app/guidance/adm/components/guidance-adm-data";
import {
  buildGcForm03Data,
  clearGcForm03Draft,
  CONCERN_OPTIONS,
  loadGcForm03Draft,
  sanitizeGcForm03Draft,
  saveGcForm03Draft,
  type GcForm03Data,
} from "@/app/guidance/adm/components/gcform03-data";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import pageStyles from "@/app/guidance/pages.module.css";
import styles from "@/app/guidance/adm/components/guidance-adm.module.css";
import formStyles from "@/app/guidance/adm/components/referral-form-dialog.module.css";
import sheetStyles from "./adm-referral-form-sheet.module.css";

/* One consultation-stage ADM case ready for the GCForm-03 fill-up. */
export interface AdmReferralFormPageCase {
  adapter: GuidanceAdmCase;
  anecdotalId: string | null;
  hasActiveSession: boolean;
  lrn: string;
}

/* Stashed review-dialog handoff, read once when the form initializes. */
export interface AdmReferralFormDraft {
  recommendation: string;
  scheduledAt?: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* Right-side slide-over shell for the fill-up form — half the page wide.
   Closing (X, overlay click, Escape, Back button) just closes the sheet;
   in-progress answers persist per referral so nothing is lost. */
function FormSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Half the page: same stacked variants as the base right-side
          styles so the override wins (base is w-3/4 capped at sm:max-w-sm). */}
      <SheetContent
        side="right"
        className="w-1/2 max-w-none data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Referral form</SheetTitle>
        <div className={sheetStyles.scrollBody}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Shared GCForm-03 referral fill-up sheet (nurse + guidance desks, same
 * UI): opens as a right-side slide-over on the referrals page — no page
 * navigation. Step 1 asks the template's questions with every answerable
 * field auto-populated from the live case + its official anecdotal
 * report, plus the review-dialog handoff. Step 2 previews the official
 * sheet with Print, Download .xlsx, and Confirm (moves the case
 * forward). Confirming pops a success toast and closes the sheet.
 */
export function AdmReferralFormSheet({
  open,
  onClose,
  referralId,
  backLabel,
  staffSectionTitle,
  signerLabel,
  showClinicSession,
  counselorName,
  casePending,
  caseError,
  activeCase,
  unavailableMessage,
  initialDraft,
  confirmToastDescription,
  onConfirm,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  referralId: string;
  backLabel: string;
  staffSectionTitle: string;
  signerLabel: string;
  showClinicSession: boolean;
  counselorName: string;
  casePending: boolean;
  caseError: boolean;
  activeCase: AdmReferralFormPageCase | null;
  unavailableMessage: string | null;
  initialDraft: AdmReferralFormDraft;
  confirmToastDescription: string;
  onConfirm: (args: { form: GcForm03Data; scheduledAt?: string }) => Promise<void>;
  onConfirmed: () => void;
}) {
  /* First client paint must match the server skeleton. */
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const reportQuery = useQuery({
    queryKey: ["gcform03-report", activeCase?.anecdotalId ?? null],
    queryFn: () => fetchOcForm01Detail(activeCase!.anecdotalId!),
    enabled: !!activeCase?.anecdotalId,
  });
  const report = reportQuery.data ?? null;
  const reportLoading = reportQuery.isPending;
  const reportError = reportQuery.isError;

  const [step, setStep] = React.useState<1 | 2>(1);
  const [form, setForm] = React.useState<GcForm03Data | null>(null);
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  /* Auto-populate once the case + report are in — plus the recommendation
     and optional session handed off by the review dialog. A saved
     in-progress fill for this referral (localStorage) is layered on top
     so a refresh restores every answer instead of starting over. */
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open || !activeCase || !report || form) return;
    const draft = initialDraft;
    if (draft.scheduledAt) {
      setSessionDate(draft.scheduledAt.slice(0, 10));
      setSessionTime(draft.scheduledAt.slice(11, 16));
    }
    const base = buildGcForm03Data(
      activeCase.adapter,
      report,
      draft.recommendation,
      counselorName
    );
    setForm(sanitizeGcForm03Draft(loadGcForm03Draft(referralId), base));
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase, report, form, referralId]);

  const patch = (p: Partial<GcForm03Data>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  /* Persist every edit (debounced) so a refresh keeps the in-progress fill. */
  React.useEffect(() => {
    if (!mounted || !form) return;
    const t = window.setTimeout(() => saveGcForm03Draft(referralId, form), 250);
    return () => window.clearTimeout(t);
  }, [form, referralId, mounted]);

  function resolveSession(): string | undefined {
    if (!showClinicSession) return undefined;
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setSessionError("Pick both a date and a time for the clinic session — or leave both empty to forward without one.");
      return null as unknown as undefined;
    }
    if (activeCase?.hasActiveSession) {
      setSessionError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return null as unknown as undefined;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setSessionError("Pick a valid date and time for the clinic session.");
      return null as unknown as undefined;
    }
    if (at.getTime() <= Date.now()) {
      setSessionError("Clinic session must be set in the future.");
      return null as unknown as undefined;
    }
    setSessionError(null);
    return `${sessionDate}T${sessionTime}:00`;
  }

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("NO_FORM");
      // Confirming is blocked while a session is still upcoming — finish
      // or cancel it first (covers booked sessions and booked follow-ups).
      if (activeCase?.hasActiveSession) throw new Error("ACTIVE_SESSION");
      const scheduledAt = resolveSession();
      if (scheduledAt === (null as unknown as undefined)) {
        throw new Error("INVALID_SESSION");
      }
      await onConfirm({ form, scheduledAt });
    },
    onSuccess: () => {
      clearGcForm03Draft(referralId);
      toast.success({
        title: "Referral confirmed",
        description: confirmToastDescription,
      });
      setStep(1);
      onConfirmed();
    },
  });

  if (!open) return null;

  if (!mounted || casePending || reportLoading) {
    return (
      <FormSheet onClose={onClose}>
      <section className={pageStyles.page} aria-busy="true">
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>ADM · Referral form</p>
            <h1 className={pageStyles.title}>GCForm-03</h1>
            <p className={pageStyles.lede}>Loading the case and its anecdotal report…</p>
          </div>
        </div>
        <Card className={pageStyles.card}>
          <CardContent>
            <div className={formStyles.form} aria-hidden="true">
              <Skeleton style={{ width: "40%", height: "1rem" }} />
              <Skeleton style={{ width: "100%", height: "4rem" }} />
              <Skeleton style={{ width: "100%", height: "4rem" }} />
              <Skeleton style={{ width: "60%", height: "2rem" }} />
            </div>
          </CardContent>
        </Card>
      </section>
      </FormSheet>
    );
  }

  if (caseError || !activeCase || reportError || (!report && !reportLoading)) {
    return (
      <FormSheet onClose={onClose}>
      <section className={pageStyles.page}>
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>ADM · Referral form</p>
            <h1 className={pageStyles.title}>GCForm-03</h1>
          </div>
        </div>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {unavailableMessage ??
              "We couldn't load the referral form. Check your connection and try again."}
          </p>
          <Button size="sm" variant="outline" onClick={onClose}>
            {backLabel}
          </Button>
        </div>
      </section>
      </FormSheet>
    );
  }

  return (
    <FormSheet onClose={onClose}>
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <p className={pageStyles.eyebrow}>ADM · Referral form</p>
          <h1 className={pageStyles.title}>GCForm-03 — {activeCase.adapter.student}</h1>
          <p className={pageStyles.lede}>
            {step === 1
              ? "Answer the form's questions — names, dates, and the anecdotal detail are already filled in."
              : "Filled referral sheet preview — print it, download the .xlsx, or confirm to save and endorse the case to the ADM coordinator."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          {backLabel}
        </Button>
      </div>

      {confirmMutation.isError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {confirmMutation.error instanceof Error &&
            confirmMutation.error.message === "ACTIVE_SESSION"
              ? "Finish or cancel the upcoming session (or follow-up) before confirming this referral."
              : confirmMutation.error instanceof Error &&
                confirmMutation.error.message === "INVALID_SESSION"
                ? "Pick both a session date and time — or leave both empty."
                : "Sorry — saving the referral did not go through. Please try again."}
          </p>
        </div>
      ) : null}

      {activeCase?.hasActiveSession ? (
        <div className={styles.errorBlock} style={{ borderStyle: "solid" }} role="alert">
          <p className={styles.errorText} style={{ fontWeight: 600 }}>
            Not ready to confirm yet — finish or cancel the upcoming session (or follow-up) first, then come back.
          </p>
        </div>
      ) : null}

      {form && step === 1 ? (
        <Card className={pageStyles.card}>
          <CardContent>
            <div className={formStyles.form}>
              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>Student</legend>
                <div className={formStyles.grid2}>
                  <div>
                    <Label htmlFor="rf-student">Name of student</Label>
                    <Input
                      id="rf-student"
                      value={form.studentName}
                      readOnly
                      className={formStyles.readonly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rf-lrn">LRN</Label>
                    <Input
                      id="rf-lrn"
                      value={activeCase.lrn}
                      readOnly
                      className={formStyles.readonly}
                    />
                  </div>
                </div>
                <div className={formStyles.grid2} style={{ marginTop: "0.75rem" }}>
                  <div>
                    <Label htmlFor="rf-grade">Grade &amp; Sec</Label>
                    <Input
                      id="rf-grade"
                      value={form.gradeSection}
                      readOnly
                      className={formStyles.readonly}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>Concerns — check all that apply</legend>
                <div className={formStyles.checks}>
                  {CONCERN_OPTIONS.map((c) => (
                    <label key={c.key} className={formStyles.check}>
                      <Checkbox
                        checked={form.concerns[c.key]}
                        onCheckedChange={(v) =>
                          patch({ concerns: { ...form.concerns, [c.key]: v === true } })
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
                {form.concerns.others ? (
                  <div className={formStyles.mt}>
                    <Label htmlFor="rf-others">Others — specify</Label>
                    <Input
                      id="rf-others"
                      value={form.concerns.othersText}
                      onChange={(e) =>
                        patch({ concerns: { ...form.concerns, othersText: e.target.value } })
                      }
                    />
                  </div>
                ) : null}
              </fieldset>

              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>Details of concern</legend>
                <Textarea
                  value={form.detailsOfConcern}
                  onChange={(e) => patch({ detailsOfConcern: e.target.value })}
                  rows={4}
                />
              </fieldset>

              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>A. Action/s taken (referrer)</legend>
                {form.referrerActions.map((r, i) => (
                  <div key={i} className={formStyles.actionRow}>
                    <span className={formStyles.actionNum}>{i + 1}.</span>
                    <Input
                      value={r.action}
                      onChange={(e) =>
                        patch({
                          referrerActions: form.referrerActions.map((a, j) =>
                            j === i ? { ...a, action: e.target.value } : a
                          ),
                        })
                      }
                      placeholder={`Action ${i + 1}`}
                      aria-label={`Referrer action ${i + 1}`}
                    />
                    <SessionDatePicker
                      id={`rf-action-date-${i}`}
                      label={`Date ${i + 1}`}
                      value={r.date}
                      onChange={(v) =>
                        patch({
                          referrerActions: form.referrerActions.map((a, j) =>
                            j === i ? { ...a, date: v } : a
                          ),
                        })
                      }
                    />
                    {form.referrerActions.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove referrer action ${i + 1}`}
                        onClick={() =>
                          patch({
                            referrerActions: form.referrerActions.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({
                        referrerActions: [...form.referrerActions, { date: "", action: "" }],
                      })
                    }
                  >
                    Add action
                  </Button>
                </div>
              </fieldset>

              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>B. Recommendations (referrer)</legend>
                <Textarea
                  value={form.referrerRecommendations}
                  onChange={(e) => patch({ referrerRecommendations: e.target.value })}
                  rows={3}
                />
                <div className={formStyles.grid3}>
                  <div>
                    <Label htmlFor="rf-by">Referred by (adviser)</Label>
                    <Input
                      id="rf-by"
                      value={form.referredByName}
                      readOnly
                      className={formStyles.readonly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rf-role">Role</Label>
                    <Input
                      id="rf-role"
                      value={form.referredByRole}
                      readOnly
                      className={formStyles.readonly}
                    />
                  </div>
                  <SessionDatePicker
                    id="rf-date"
                    label="Date"
                    value={form.referredDate}
                    onChange={(v) => patch({ referredDate: v })}
                  />
                </div>
              </fieldset>

              <fieldset className={formStyles.group}>
                <legend className={formStyles.legend}>{staffSectionTitle}</legend>
                <p className={formStyles.tableTitle}>A. Action/s Taken</p>
                <div className={formStyles.callHead} aria-hidden="true">
                  <span />
                  <span />
                  <span>Date</span>
                  <span>Subject / Time</span>
                  <span>Remarks</span>
                </div>
                {form.guidanceCalls.map((r) => (
                  <div key={r.call} className={formStyles.callRow}>
                    <Checkbox
                      checked={r.checked}
                      onCheckedChange={(v) =>
                        patch({
                          guidanceCalls: form.guidanceCalls.map((a) =>
                            a.call === r.call ? { ...a, checked: v === true } : a
                          ),
                        })
                      }
                      aria-label={`Check ${r.call} call`}
                    />
                    <span className={formStyles.callLabel}>{r.call} Call</span>
                    <SessionDatePicker
                      id={`rf-g-date-${r.call}`}
                      label={`Date`}
                      value={r.date}
                      onChange={(v) =>
                        patch({
                          guidanceCalls: form.guidanceCalls.map((a) =>
                            a.call === r.call ? { ...a, date: v } : a
                          ),
                        })
                      }
                    />
                    <Input
                      value={r.subject}
                      onChange={(e) =>
                        patch({
                          guidanceCalls: form.guidanceCalls.map((a) =>
                            a.call === r.call ? { ...a, subject: e.target.value } : a
                          ),
                        })
                      }
                      placeholder="Subject / Time"
                      aria-label={`${r.call} call subject or time`}
                    />
                    <Input
                      value={r.remarks}
                      onChange={(e) =>
                        patch({
                          guidanceCalls: form.guidanceCalls.map((a) =>
                            a.call === r.call ? { ...a, remarks: e.target.value } : a
                          ),
                        })
                      }
                      placeholder="Remarks"
                      aria-label={`${r.call} call remarks`}
                    />
                  </div>
                ))}
                <div className={formStyles.mt}>
                  <Label htmlFor="rf-grec">B. Recommendations</Label>
                  <Textarea
                    id="rf-grec"
                    value={form.guidanceRecommendations}
                    onChange={(e) => patch({ guidanceRecommendations: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className={formStyles.mt}>
                  <Label htmlFor="rf-follow">C. Follow up</Label>
                  <Textarea
                    id="rf-follow"
                    value={form.followUp}
                    onChange={(e) => patch({ followUp: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className={formStyles.grid2}>
                  <div>
                    <Label htmlFor="rf-counselor">{signerLabel}</Label>
                    <Input
                      id="rf-counselor"
                      value={form.counselorName}
                      onChange={(e) => patch({ counselorName: e.target.value })}
                      placeholder="Printed name"
                    />
                  </div>
                  <SessionDatePicker
                    id="rf-cdate"
                    label="Date"
                    value={form.counselorDate}
                    onChange={(v) => patch({ counselorDate: v })}
                  />
                </div>
              </fieldset>

              {showClinicSession ? (
                <fieldset className={formStyles.group}>
                  <legend className={formStyles.legend}>Clinic session (optional)</legend>
                  <div className={formStyles.grid2}>
                    <ClinicDatePicker
                      id="rf-session-date"
                      label="Date"
                      value={sessionDate}
                      onChange={setSessionDate}
                      min={todayKey()}
                    />
                    <ClinicTimePicker
                      id="rf-session-time"
                      label="Time"
                      value={sessionTime}
                      onChange={setSessionTime}
                    />
                  </div>
                  <p className={formStyles.mt} style={{ fontSize: "0.8125rem", opacity: 0.75 }}>
                    {activeCase?.hasActiveSession
                      ? "A session that is not done yet is already booked on this case — leave the session empty, or finish/cancel the existing one first."
                      : "Held at the school clinic. Leave both empty to forward without booking."}
                  </p>
                  {sessionError ? (
                    <p className={styles.errorText} role="alert">{sessionError}</p>
                  ) : null}
                </fieldset>
              ) : null}

              <div
                className={styles.actions}
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <Button disabled={!form} onClick={() => setStep(2)}>
                  Preview filled form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!form}
                  onClick={() => {
                    if (!activeCase || !report) return;
                    clearGcForm03Draft(referralId);
                    setSessionDate("");
                    setSessionTime("");
                    setSessionError(null);
                    setForm(
                      buildGcForm03Data(activeCase.adapter, report, "", counselorName)
                    );
                  }}
                >
                  Reset to auto-filled
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {form ? (
        <GcForm03PreviewDialog
          open={step === 2}
          data={form}
          confirming={confirmMutation.isPending}
          onClose={() => setStep(1)}
          onConfirm={() => confirmMutation.mutate()}
        />
      ) : null}
    </section>
    </FormSheet>
  );
}
