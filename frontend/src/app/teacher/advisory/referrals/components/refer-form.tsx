"use client";
import * as React from "react";
import { Check, FileText, Loader2, NotebookPen, Send, Users } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { useTerm } from "@/lib/term/TermContext";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";
import { apiClient } from "@/lib/api/client";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import refStyles from "./referrals.module.css";

const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

function LrnPill({ lrn }: { lrn: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md border border-border bg-secondary px-1.5 py-px text-xs font-medium text-secondary-foreground"
      title={lrn}
    >
      {lrn}
    </span>
  );
}

function CategoryPill({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "var(--muted-foreground)";
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-xs font-semibold leading-tight"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={categoryLabel(category)}
    >
      {categoryLabel(category)}
    </span>
  );
}
import { useReferableRecords } from "./use-referable-records";
import { ReferPicker } from "./refer-picker";
import { categoryLabel, recordLabel, studentLabel } from "./referable-group";
import {
  REFERRAL_TYPES,
  STAFF_BY_TYPE,
  filedToLabel,
  findStaff,
} from "./referral-types";
export interface ReferralSubmitSnapshot {
  studentName: string;
  deskLabel: string;
  /** Short desk name for the narrow submit dock (no "— moves to…" suffix). */
  shortDeskLabel: string;
}

/** Prefill for "Refer again": student + record + desk are restored so only
    a fresh reason is needed. Everything stays editable. */
export interface ReferFormSeed {
  anecdotalId?: string | null;
  typeKey?: string;
  staffValue?: string;
}

export function ReferForm({
  onDone,
  onSubmitStart,
  onSubmitEnd,
  seed,
}: {
  onDone: () => void;
  /** Fired synchronously on Send click so the page can dock the timeline instantly. */
  onSubmitStart?: (snap: ReferralSubmitSnapshot) => void;
  /** Fired when the POST settles (modal still open on error, closed by caller on success). */
  onSubmitEnd?: (ok: boolean, snap: ReferralSubmitSnapshot & { message?: string }) => void;
  seed?: ReferFormSeed | null;
}) {
  const invalidateTeacher = useTeacherInvalidate();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const { referablesQuery, students } = useReferableRecords(termKey);
  const [studentKey, setStudentKey] = React.useState("");
  const [recordId, setRecordId] = React.useState("");
  const [typeKey, setTypeKey] = React.useState(seed?.typeKey ?? "");
  const [staffValue, setStaffValue] = React.useState(seed?.staffValue ?? "");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Direct-autofill the referred-again record once the referable list lands.
  // Type/desk come from state initializers above (the dialog remounts fresh
  // on every open); the record needs the async list, so it resolves here.
  const seededRecord = React.useRef(false);
  React.useEffect(() => {
    const id = seed?.anecdotalId;
    if (!id || seededRecord.current || students.length === 0) return;
    const owner = students.find((s) => s.records.some((r) => r.id === id));
    if (!owner) return;
    seededRecord.current = true;
    setStudentKey(owner.key);
    setRecordId(id);
  }, [seed?.anecdotalId, students]);
  const student = students.find((s) => s.key === studentKey) ?? null;
  const record = student?.records.find((r) => r.id === recordId) ?? null;
  const staff = staffValue ? findStaff(staffValue) : null;
  const staffOptions = (typeKey === "adm" || typeKey === "other" ? STAFF_BY_TYPE[typeKey] : []);
  const canSubmit =
    !!student && !!record && !!staff && reason.trim() !== "" && !pending;
  async function handleSubmit() {
    if (!canSubmit || !student || !record || !staff) return;
    const snap: ReferralSubmitSnapshot = {
      studentName: student.studentName,
      deskLabel: filedToLabel(staff),
      shortDeskLabel: staff.label,
    };
    onSubmitStart?.(snap);
    // Close the overlay right away — the bottom-right dock owns the
    // background progress from here (success and failure both land there).
    onDone();
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
      onSubmitEnd?.(true, snap);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Could not submit this referral.";
      setError(message);
      onSubmitEnd?.(false, { ...snap, message });
      sileo.error({ title: "Could not submit referral", description: message });
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className={refStyles.formGrid} aria-label="New referral details">
      {referablesQuery.isPending ? (
        <div className="flex min-w-0 flex-col gap-2 [grid-column:1/-1]" aria-busy="true" aria-label="Loading referable records">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-md bg-muted" />
          ))}
        </div>
      ) : referablesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive [grid-column:1/-1]">
          Could not load referable records.
        </p>
      ) : students.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground [grid-column:1/-1]">
          No referable records right now — anecdotal records you log will
          appear here.
        </p>
      ) : (
        <>
          <KanbanBoard
            title="Student"
            icon={
              <span className="text-blue-500" aria-hidden>
                <Users size={14} />
              </span>
            }
            ariaLabel="Student"
            className="h-full [font-family:var(--font-inter)]"
          >
            <ReferPicker
              id="refer-student"
              label="Student"
              placeholder="Pick a student"
              value={student ? student.studentName : null}
              valueNode={
                student ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-medium" title={studentLabel(student)}>
                      {student.studentName}
                    </span>
                    <LrnPill lrn={student.lrn} />
                  </span>
                ) : undefined
              }
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
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium" title={studentLabel(s)}>
                          {s.studentName}
                        </span>
                        <LrnPill lrn={s.lrn} />
                      </span>
                      {s.key === studentKey ? (
                        <Check size={16} className="shrink-0" aria-hidden />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </ReferPicker>
          </KanbanBoard>

          <KanbanBoard
            title="Anecdotal record"
            icon={
              <span className="text-amber-500" aria-hidden>
                <FileText size={14} />
              </span>
            }
            ariaLabel="Anecdotal record"
            className="h-full [font-family:var(--font-inter)]"
          >
            <ReferPicker
              id="refer-record"
              label="Anecdotal record"
              placeholder={student ? "Pick a record" : "Pick a student first"}
              value={record ? recordLabel(record) : null}
              valueNode={
                record ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="min-w-0 truncate text-sm font-medium"
                      title={`${record.observationDate} · ${categoryLabel(record.category)}`}
                    >
                      {record.observationDate}
                    </span>
                    <CategoryPill category={record.category} />
                  </span>
                ) : undefined
              }
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
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <span
                          className="truncate text-sm font-medium"
                          title={`${r.observationDate} · ${categoryLabel(r.category)}`}
                        >
                          {r.observationDate}
                        </span>
                        <CategoryPill category={r.category} />
                      </span>
                      {r.id === recordId ? (
                        <Check size={16} className="shrink-0" aria-hidden />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </ReferPicker>
          </KanbanBoard>

          <KanbanBoard
            title="Referral type"
            icon={
              <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                <Send size={14} />
              </span>
            }
            ariaLabel="Referral type"
            className="h-full [font-family:var(--font-inter)]"
          >
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
              <p className="px-1 text-xs text-muted-foreground">
                Filed to:{" "}
                <span className="font-medium text-foreground">{filedToLabel(staff)}</span>
              </p>
            ) : null}
          </KanbanBoard>

          <KanbanBoard
            title="Reason"
            icon={
              <span className="text-blue-500" aria-hidden>
                <NotebookPen size={14} />
              </span>
            }
            ariaLabel="Reason"
            className="h-full [font-family:var(--font-inter)]"
          >
            <div className="flex min-w-0 flex-col gap-1.5 px-1">
              <Label htmlFor="refer-reason">Reason</Label>
              <Textarea
                id="refer-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this student being referred?"
                rows={3}
              />
            </div>
          </KanbanBoard>
        </>
      )}
      </div>
      {!referablesQuery.isPending && !referablesQuery.isError && students.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={pending || undefined}
            className="h-6 px-2.5 text-xs"
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
      ) : null}
    </>
  );
}
