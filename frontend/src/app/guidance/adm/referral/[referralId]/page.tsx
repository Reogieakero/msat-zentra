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
import { SessionDatePicker } from "../../../referrals/components/session-datetime-picker";
import {
  fetchGuidanceAdm,
  reviewAdmConsultation,
} from "../../components/guidance-adm-data";
import {
  buildGcForm03Data,
  CONCERN_OPTIONS,
  REFERRAL_DRAFT_KEY,
  type GcForm03Data,
} from "../../components/gcform03-data";
import { GcForm03PreviewDialog } from "../../components/GcForm03PreviewDialog";
import pageStyles from "../../../pages.module.css";
import styles from "../../components/guidance-adm.module.css";
import formStyles from "../../components/referral-form-dialog.module.css";

const DRAFT_KEY = REFERRAL_DRAFT_KEY;

/**
 * Dedicated GCForm-03 referral form page for one consultation-stage ADM case.
 * Step 1 asks the template's questions with every answerable field
 * auto-populated from the live case + its official anecdotal report (all
 * dates use the calendar date picker). Preview opens in the official-sheet
 * modal (same pattern as the anecdotal GCForm-01 preview) with Print,
 * Download .xlsx (a value-only fill of the public-folder template — the
 * .xlsx design itself is never altered), and Confirm referral (moves the
 * case forward).
 */
export default function GuidanceAdmReferralPage() {
  const params = useParams<{ referralId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const referralId = decodeURIComponent(params.referralId ?? "");
  /* First client paint must match the server skeleton (see adm/page). */
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const casesQuery = useQuery({
    queryKey: ["guidance-adm"],
    queryFn: () => fetchGuidanceAdm({ pageSize: 100 }),
  });
  const activeCase =
    casesQuery.data?.cases.find((c) => c.referralId === referralId) ??
    casesQuery.data?.reviewQueue.find((c) => c.referralId === referralId) ??
    null;

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

  /* Auto-populate once the case + report are in — plus the recommendation
     the counselor typed on the review overlay (stashed before navigating). */
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!activeCase || !report || form) return;
    let draft = "";
    try {
      draft = window.sessionStorage.getItem(DRAFT_KEY) ?? "";
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      draft = "";
    }
    setForm(
      buildGcForm03Data(
        activeCase,
        report,
        draft,
        casesQuery.data?.counselorName ?? ""
      )
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeCase, report, form, casesQuery.data?.counselorName]);

  const patch = (p: Partial<GcForm03Data>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  const confirmMutation = useMutation({
    mutationFn: () =>
      reviewAdmConsultation(referralId, {
        recommendation: form?.guidanceRecommendations.trim() || "Referred for ADM.",
        outcome: "endorse",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      router.push("/guidance/adm");
    },
  });

  if (!mounted || casesQuery.isPending || reportLoading) {
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

  if (casesQuery.isError || !activeCase || reportError || (!report && !reportLoading)) {
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
            {!activeCase
              ? "This case is no longer waiting for review — it may have been decided already."
              : "We couldn't load the referral form. Check your connection and try again."}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/guidance/adm">Back to ADM cases</Link>
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
          <h1 className={pageStyles.title}>GCForm-03 — {activeCase.student}</h1>
          <p className={pageStyles.lede}>
            {step === 1
              ? "Answer the form's questions — names, dates, and the anecdotal detail are already filled in."
              : "Filled referral sheet preview — print it, download the .xlsx, or confirm to create the referral."}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/guidance/adm">Back to ADM cases</Link>
        </Button>
      </div>

      {confirmMutation.isError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — creating the referral did not go through. Please try again.
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
                <legend className={formStyles.legend}>Guidance counselor section</legend>
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
                    <Label htmlFor="rf-counselor">Guidance Counselor / Career Advocate</Label>
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

              <div className={styles.actions}>
                <Button disabled={!form} onClick={() => setStep(2)}>
                  Preview filled form
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
