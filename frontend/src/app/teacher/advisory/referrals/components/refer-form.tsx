"use client";
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";
import { apiClient } from "@/lib/api/client";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import { useReferableRecords } from "./use-referable-records";
import { ReferPicker } from "./refer-picker";
import { categoryLabel, recordLabel, studentLabel, truncate } from "./referable-group";
import {
  REFERRAL_TYPES,
  STAFF_BY_TYPE,
  filedToLabel,
  findStaff,
} from "./referral-types";
export function ReferForm({ onDone }: { onDone: () => void }) {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { referablesQuery, students } = useReferableRecords(termKey);
  const [studentKey, setStudentKey] = React.useState("");
  const [recordId, setRecordId] = React.useState("");
  const [typeKey, setTypeKey] = React.useState("");
  const [staffValue, setStaffValue] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const student = students.find((s) => s.key === studentKey) ?? null;
  const record = student?.records.find((r) => r.id === recordId) ?? null;
  const staff = staffValue ? findStaff(staffValue) : null;
  const staffOptions = (typeKey === "adm" || typeKey === "other" ? STAFF_BY_TYPE[typeKey] : []);
  const canSubmit =
    !!student && !!record && !!staff && reason.trim() !== "" && !pending;
  async function handleSubmit() {
    if (!canSubmit || !record || !staff) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await apiClient.post<{ id: string }>(`/api/anecdotal/${record.id}/refer`, {
        referredToRole: staff.desk,
        reason: reason.trim(),
        ...(staff.reviewer ? { consultReviewer: staff.reviewer } : {}),
      });
      if (data?.id) markSelfNotified(data.id);
      invalidateTeacher.referrals();
      sileo.success({
        title: "Referral submitted",
        description: "The receiving desk has been notified.",
      });
      setStudentKey("");
      setRecordId("");
      setTypeKey("");
      setStaffValue("");
      setReason("");
      setError(null);
      onDone();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Could not submit this referral.";
      setError(message);
      sileo.error({ title: "Could not submit referral", description: message });
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={assign.card} aria-label="New referral details">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 className={styles.sectionTitle}>New referral</h2>
        <p className={styles.sectionDesc}>
          Pick a student, then their record.
        </p>
      </div>
      {referablesQuery.isPending ? (
        <div className="relative flex flex-col gap-2" aria-busy="true" aria-label="Loading referable records">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-md bg-muted" />
          ))}
        </div>
      ) : referablesQuery.isError ? (
        <p role="alert" className="relative text-sm text-destructive">
          Could not load referable records.
        </p>
      ) : students.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">
          No referable records right now — anecdotal records you log will
          appear here.
        </p>
      ) : (
        <div className="relative flex flex-col gap-3">
          <ReferPicker
            id="refer-student"
            label="Student"
            placeholder="Pick a student"
            value={student ? student.studentName : null}
            title={student ? studentLabel(student) : undefined}
          >
            {(close) => (
              <>
                {students.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onSelect={() => {
                      setStudentKey(s.key);
                      setRecordId("");
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.studentName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.lrn} · {s.section}
                      </span>
                    </span>
                    {s.key === studentKey ? (
                      <Check size={16} className="shrink-0" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </ReferPicker>
          <ReferPicker
            id="refer-record"
            label="Anecdotal record"
            placeholder={student ? "Pick a record" : "Pick a student first"}
            value={record ? recordLabel(record) : null}
            disabled={!student}
          >
            {(close) => (
              <>
                {(student?.records ?? []).map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onSelect={() => {
                      setRecordId(r.id);
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.observationDate}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {categoryLabel(r.category)}
                      </span>
                    </span>
                    {r.id === recordId ? (
                      <Check size={16} className="shrink-0" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </ReferPicker>
          {record ? (
            <p className="truncate text-xs text-muted-foreground" title={record.excerpt}>
              {truncate(record.excerpt, 80)}
            </p>
          ) : null}
          <ReferPicker
            id="refer-type"
            label="Referral type"
            placeholder="Pick a type"
            value={REFERRAL_TYPES.find((t) => t.key === typeKey)?.label ?? null}
          >
            {(close) => (
              <>
                {REFERRAL_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={t.key}
                    onSelect={() => {
                      setTypeKey(t.key);
                      setStaffValue("");
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.hint}
                      </span>
                    </span>
                    {t.key === typeKey ? (
                      <Check size={16} className="shrink-0" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </ReferPicker>
          <ReferPicker
            id="refer-staff"
            label="Received by"
            placeholder={typeKey ? "Pick staff" : "Pick a type first"}
            value={staff?.label ?? null}
            title={staff ? filedToLabel(staff) : undefined}
            disabled={!typeKey}
          >
            {(close) => (
              <>
                {staffOptions.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onSelect={() => {
                      setStaffValue(s.value);
                      close();
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.hint}
                      </span>
                    </span>
                    {s.value === staffValue ? (
                      <Check size={16} className="shrink-0" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </ReferPicker>
          {staff ? (
            <p className="text-xs text-muted-foreground">
              Filed to:{" "}
              <span className="font-medium text-foreground">{filedToLabel(staff)}</span>
            </p>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="refer-reason">Reason</Label>
            <Textarea
              id="refer-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this student being referred?"
              rows={3}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={onDone}
              disabled={pending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-busy={pending || undefined}
              className="flex-1"
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Sending…</span>
                </>
              ) : (
                "Send referral"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
