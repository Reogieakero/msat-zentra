"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { SessionDatePicker } from "@/app/guidance/referrals/components/session-datetime-picker";
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
import { toast } from "@/components/ui/sonner";
import {
  fetchNurseOverview,
  loadNurseReferralDraft,
  confirmNurseReferralAndEndorse,
  type NurseAdmReferralForm,
} from "../../../overview/components/nurse-overview-data";
import {
  ClinicDatePicker,
  ClinicTimePicker,
} from "../../../overview/components/ClinicDateTimePicker";
import pageStyles from "@/app/guidance/pages.module.css";
import styles from "@/app/guidance/adm/components/guidance-adm.module.css";
import formStyles from "@/app/guidance/adm/components/referral-form-dialog.module.css";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dedicated GCForm-03 referral form page for one nurse consultation-stage ADM
 * case — the same official form and fill-up flow as the guidance referral
 * page (/guidance/adm/referral/[referralId]), reached via Create referral
 * from the nurse Review ADM dialog. Step 1 asks the template's questions
 * with every answerable field auto-populated from the live case + its
 * official anecdotal report (plus the nurse's optional clinic session);
 * Preview opens the official-sheet modal with Print, Download .xlsx, and
 * Confirm & forward (endorses the case to the ADM coordinator).
 */
export default function NurseAdmReferralPage() {
  const params = useParams<{ referralId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const referralId = decodeURIComponent(params.referralId ?? "");
  /* First client paint must match the server skeleton. */
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["nurse-overview"],
    queryFn: fetchNurseOverview,
  });
  const activeRow =
    overviewQuery.data?.needsReview.find((r) => r.id === referralId) ?? null;
  const reviewable =
    !!activeRow && activeRow.type === "ADM" && activeRow.status === "pending";

  const reportQuery = useQuery({
    queryKey: ["gcform03-report", activeRow?.anecdotalId ?? null],
    queryFn: () => fetchOcForm01Detail(activeRow!.anecdotalId!),
    enabled: !!activeRow?.anecdotalId,
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
     and optional session the nurse entered on the review dialog (stashed
     before navigating). A saved in-progress fill for this referral
     (localStorage) is layered on top so a refresh restores every answer. */
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!activeRow || !report || form) return;
    const draft = loadNurseReferralDraft();
    if (draft?.scheduledAt) {
      setSessionDate(draft.scheduledAt.slice(0, 10));
      setSessionTime(draft.scheduledAt.slice(11, 16));
    }
    const adapter: GuidanceAdmCase = {
      id: activeRow.id,
      student: activeRow.student,
      lrn: activeRow.lrn,
      section: activeRow.section,
      grade: activeRow.grade,
      stage: "consultation",
      stageLabel: "Consultation and referral",
      eligibility: "pending",
      referralId: activeRow.id,
      referralStatus: activeRow.status,
      reason: activeRow.reason,
      referredBy: "",
      preparedBy: "",
      date: activeRow.date,
      meetingAttended: null,
      hasHomeVisit: false,
      approved: false,
      approvedAt: null,
      anecdotalId: activeRow.anecdotalId ?? undefined,
      category: activeRow.category,
      anecdotalExcerpt: activeRow.anecdotal?.incident ?? "",
      recommendations: activeRow.anecdotal?.notes ?? "",
    };
    const base = buildGcForm03Data(adapter, report, draft?.recommendation ?? "", "");
    setForm(sanitizeGcForm03Draft(loadGcForm03Draft(referralId), base));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeRow, report, form, referralId]);

  const patch = (p: Partial<GcForm03Data>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  /* Persist every edit (debounced) so a refresh keeps the in-progress fill. */
  React.useEffect(() => {
    if (!mounted || !form) return;
    const t = window.setTimeout(() => saveGcForm03Draft(referralId, form), 250);
    return () => window.clearTimeout(t);
  }, [form, referralId, mounted]);

  function resolveSession(): string | undefined {
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setSessionError("Pick both a date and a time for the clinic session — or leave both empty to forward without one.");
      return null as unknown as undefined;
    }
    if (activeRow?.sessions.some((s) => s.status === "scheduled")) {
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

  function referralFormOf(f: GcForm03Data): NurseAdmReferralForm {
    const checked = CONCERN_OPTIONS.filter((c) => f.concerns[c.key]);
    const concerns = checked.map((c) =>
      c.key === "others" && f.concerns.othersText.trim()
        ? `Others: ${f.concerns.othersText.trim()}`
        : c.label
    );
    const actionBits = f.referrerActions
      .map((a) => [a.action.trim(), a.date.trim()].filter(Boolean).join(" "))
      .filter(Boolean);
    const nurseBits = [
      ...(f.referrerRecommendations.trim() ? [f.referrerRecommendations.trim()] : []),
      ...(actionBits.length > 0 ? [`Actions: ${actionBits.join("; ")}`] : []),
    ];
    return {
      ...(concerns.length > 0 ? { concerns } : {}),
      ...(f.detailsOfConcern.trim()
        ? { detailsOfConcern: f.detailsOfConcern.trim().slice(0, 2000) }
        : {}),
      ...(nurseBits.length > 0
        ? { nurseActions: nurseBits.join(" | ").slice(0, 2000) }
        : {}),
      ...(f.followUp.trim() ? { followUp: f.followUp.trim().slice(0, 2000) } : {}),
    };
  }

  // Confirming SAVES the referral form AND endorses the case to the ADM
  // coordinator at once (auto-endorse) — then returns to the referrals page.
  // Nothing redirects to the alerts page.
  const confirmMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = resolveSession();
      if (scheduledAt === (null as unknown as undefined)) {
        throw new Error("INVALID_SESSION");
      }
      return confirmNurseReferralAndEndorse(referralId, {
        recommendation: form?.guidanceRecommendations.trim() || "Referred for ADM.",
        scheduledAt,
        referralForm: form ? referralFormOf(form) : undefined,
      });
    },
    onSuccess: () => {
      clearGcForm03Draft(referralId);
      queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
      queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
      toast.success({
        title: "Referral confirmed",
        description: "The case was endorsed to the ADM coordinator.",
      });
      router.push("/nurse/referrals");
    },
  });

  if (!mounted || overviewQuery.isPending || reportLoading) {
    return (
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
    );
  }

  if (
    overviewQuery.isError ||
    !activeRow ||
    !reviewable ||
    !activeRow.anecdotalId ||
    reportError ||
    (!report && !reportLoading)
  ) {
    return (
      <section className={pageStyles.page}>
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>ADM · Referral form</p>
            <h1 className={pageStyles.title}>GCForm-03</h1>
          </div>
        </div>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {!activeRow || !reviewable
              ? "This case is no longer waiting for review — it may have been decided already."
              : "We couldn't load the referral form. Check your connection and try again."}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/nurse/alerts">Back to alerts</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <p className={pageStyles.eyebrow}>ADM · Referral form</p>
          <h1 className={pageStyles.title}>GCForm-03 — {activeRow.student}</h1>
          <p className={pageStyles.lede}>
            {step === 1
              ? "Answer the form's questions — names, dates, and the anecdotal detail are already filled in."
              : "Filled referral sheet preview — print it, download the .xlsx, or confirm to save and endorse the case to the ADM coordinator."}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/nurse/alerts">Back to alerts</Link>
        </Button>
      </div>

      {confirmMutation.isError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {confirmMutation.error instanceof Error &&
            confirmMutation.error.message === "INVALID_SESSION"
              ? "Pick both a session date and time — or leave both empty."
              : "Sorry — saving the referral did not go through. Please try again."}
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
                      value={activeRow.lrn}
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
                <legend className={formStyles.legend}>School nurse section</legend>
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
                    <Label htmlFor="rf-counselor">School Nurse</Label>
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
                  {activeRow?.sessions.some((s) => s.status === "scheduled")
                    ? "A session that is not done yet is already booked on this case — leave the session empty, or finish/cancel the existing one first."
                    : "Held at the school clinic. Leave both empty to forward without booking."}
                </p>
                {sessionError ? (
                  <p className={styles.errorText} role="alert">{sessionError}</p>
                ) : null}
              </fieldset>

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
                    if (!activeRow || !report) return;
                    clearGcForm03Draft(referralId);
                    setSessionDate("");
                    setSessionTime("");
                    setSessionError(null);
                    const adapter: GuidanceAdmCase = {
                      id: activeRow.id,
                      student: activeRow.student,
                      lrn: activeRow.lrn,
                      section: activeRow.section,
                      grade: activeRow.grade,
                      stage: "consultation",
                      stageLabel: "Consultation and referral",
                      eligibility: "pending",
                      referralId: activeRow.id,
                      referralStatus: activeRow.status,
                      reason: activeRow.reason,
                      referredBy: "",
                      preparedBy: "",
                      date: activeRow.date,
                      meetingAttended: null,
                      hasHomeVisit: false,
                      approved: false,
                      approvedAt: null,
                      anecdotalId: activeRow.anecdotalId ?? undefined,
                      category: activeRow.category,
                      anecdotalExcerpt: activeRow.anecdotal?.incident ?? "",
                      recommendations: activeRow.anecdotal?.notes ?? "",
                    };
                    setForm(buildGcForm03Data(adapter, report, "", ""));
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
  );
}
