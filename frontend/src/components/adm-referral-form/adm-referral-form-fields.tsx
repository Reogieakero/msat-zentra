"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SessionDatePicker } from "@/app/guidance/referrals/components/session-datetime-picker";
import { ClinicDatePicker, ClinicTimePicker } from "@/app/nurse/overview/components/ClinicDateTimePicker";
import { CONCERN_OPTIONS, type GcForm03Data } from "@/services/guidance/gcform03.types";
import { todayKey } from "./today-key";
import type { AdmReferralFormPageCase } from "./AdmReferralFormPage";
import pageStyles from "@/app/guidance/pages.module.css";
import styles from "@/app/guidance/adm/components/guidance-adm.module.css";
import formStyles from "@/app/guidance/adm/components/referral-form-dialog.module.css";

export function AdmReferralFormFields({
  form,
  patch,
  sessionDate,
  sessionTime,
  sessionError,
  setSessionDate,
  setSessionTime,
  showClinicSession,
  activeCase,
  staffSectionTitle,
  signerLabel,
  onPreview,
  onReset,
}: {
  form: GcForm03Data;
  patch: (p: Partial<GcForm03Data>) => void;
  sessionDate: string;
  sessionTime: string;
  sessionError: string | null;
  setSessionDate: (v: string) => void;
  setSessionTime: (v: string) => void;
  showClinicSession: boolean;
  activeCase: AdmReferralFormPageCase;
  staffSectionTitle: string;
  signerLabel: string;
  onPreview: () => void;
  onReset: () => void;
}) {
  return (
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
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}
                >
                <Button disabled={!form} onClick={onPreview}>
                  Preview filled form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!form}
                  onClick={onReset}
                >
                  Reset to auto-filled
                </Button>
                </div>
              </div>
            </CardContent>
          </Card>
  );
}
