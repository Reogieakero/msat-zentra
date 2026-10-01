"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RotateCcw, Send } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { cn } from "@/lib/utils";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import refStyles from "./referrals.module.css";
import { useReopenReferral } from "./use-reopen-referral";
import {
  DESK_LABELS,
  REFERRAL_TYPES,
  STAFF_BY_TYPE,
  filedToLabel,
  findStaff,
} from "./referral-types";

interface ReferableRecord {
  id: string;
  observationDate: string;
  studentId?: string;
  studentName: string;
  section: string;
  lrn: string;
  category: string;
  excerpt: string;
  hasReferral?: boolean;
}

interface StudentOption {
  key: string;
  studentName: string;
  lrn: string;
  section: string;
  records: ReferableRecord[];
}

/* A dismissed case is filed again from its table row (Refer again reopens
   it to pending) — the card only files records with no referral yet, so one
   record never carries two live rows. */
function groupReferable(records: ReferableRecord[]): StudentOption[] {
  const map = new Map<string, StudentOption>();
  for (const r of records) {
    if (r.hasReferral) continue;
    const key = r.studentId ?? r.lrn ?? `${r.studentName} · ${r.lrn}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section,
        records: [],
      };
      map.set(key, entry);
    }
    entry.records.push(r);
  }
  return [...map.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
}

function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/* Single source for dropdown labels — the trigger value and the menu item
   label always render the exact same string. */
function studentLabel(s: Pick<StudentOption, "studentName" | "lrn">): string {
  return `${s.studentName} · ${s.lrn}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  bullying: "Bullying",
  academic: "Academic",
  attendance: "Attendance",
  health: "Health",
};

function categoryLabel(value: string): string {
  return (
    CATEGORY_LABELS[value] ??
    (value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value)
  );
}

function recordLabel(r: Pick<ReferableRecord, "observationDate" | "category">): string {
  return `${r.observationDate} · ${categoryLabel(r.category)}`;
}

/* Dropdown-menu picker (shadcn DropdownMenu — never a native select). */
function Picker({
  id,
  label,
  placeholder,
  value,
  title,
  disabled,
  children,
}: {
  id: string;
  label?: string;
  placeholder: string;
  value: string | null;
  title?: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label ?? placeholder}
            title={title ?? value ?? undefined}
            className={cn(
              "flex w-full items-center justify-start font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="min-w-0 truncate">{value ?? placeholder}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={`max-h-64 overflow-y-auto w-[var(--radix-dropdown-menu-trigger-width)] ${refStyles.noScrollbar}`}
        >
          {children(() => setOpen(false))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* Referral form card: student dropdown, then that student's anecdotal
   records dropdown, receiving desk, reason, send. */
function ReferFormCard({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const referablesQuery = useQuery<ReferableRecord[]>({
    queryKey: ["referableAnecdotal"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/anecdotal/referable");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const students = React.useMemo(
    () => groupReferable(referablesQuery.data ?? []),
    [referablesQuery.data],
  );

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
      // Suppress the channel echo toast for our own submit (the success
      // toast below already fired) — the bell row still lands for badge.
      if (data?.id) markSelfNotified(data.id);
      await queryClient.invalidateQueries({ queryKey: ["myReferrals"] });
      await queryClient.invalidateQueries({ queryKey: ["referableAnecdotal"] });
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
          <Picker
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
          </Picker>
          <Picker
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
          </Picker>
          {record ? (
            <p className="truncate text-xs text-muted-foreground" title={record.excerpt}>
              {truncate(record.excerpt, 80)}
            </p>
          ) : null}
          <Picker
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
          </Picker>
          <Picker
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
          </Picker>
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

interface DismissedMine {
  id: string;
  studentName: string;
  lrn: string;
  targetRole: string;
  status: string;
}

/* Cancelled cases, ready to file again — same reopen as the table row menu
   (the row flips back to pending, never a duplicate). Hidden when none. */
function DismissedRereferCard() {
  const mineQuery = useQuery<DismissedMine[]>({
    queryKey: ["myReferrals"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/referrals/mine");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
  const { reopen, isPending } = useReopenReferral();

  const dismissed = React.useMemo(
    () => (mineQuery.data ?? []).filter((r) => r.status === "dismissed"),
    [mineQuery.data],
  );

  if (!mineQuery.isPending && dismissed.length === 0) return null;

  return (
    <div className={assign.card} aria-label="Refer cancelled cases again">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <RotateCcw size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h2 className={styles.sectionTitle}>Refer again</h2>
          <p className={styles.sectionDesc}>
            Cancelled cases, back to pending.
          </p>
        </div>
      </div>
      {mineQuery.isPending ? (
        <div className="relative flex flex-col gap-2" aria-busy="true" aria-label="Loading cancelled referrals">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <ul className={`relative flex max-h-80 min-w-0 flex-col gap-2 overflow-y-auto ${refStyles.noScrollbar}`}>
          {dismissed.map((r) => (
            <DismissedRow
              key={r.id}
              row={r}
              busy={isPending}
              onReopen={(id, desk, reviewer) =>
                void reopen(
                  { id },
                  { referredToRole: desk, ...(reviewer ? { consultReviewer: reviewer } : {}) },
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* One dismissed case: pick who receives the file (grouped by the 2 types),
   then re-submit. The row flips back to pending, never a duplicate. */
function DismissedRow({
  row,
  busy,
  onReopen,
}: {
  row: DismissedMine;
  busy: boolean;
  onReopen: (id: string, desk: string, reviewer: string | null) => void;
}) {
  const [staffValue, setStaffValue] = React.useState("");
  const staff = staffValue ? findStaff(staffValue) : null;
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-md border border-transparent px-1 py-1">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{row.studentName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          Was with the {DESK_LABELS[row.targetRole] ?? row.targetRole}
        </span>
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Picker
            id={`rerefer-staff-${row.id}`}
            placeholder="Pick staff"
            value={staff?.label ?? null}
            title={staff ? filedToLabel(staff) : undefined}
          >
            {(close) => (
              <>
                {REFERRAL_TYPES.map((t) => (
                  <DropdownMenuGroup key={t.key}>
                    <DropdownMenuLabel className="text-xs font-semibold">
                      {t.label}
                    </DropdownMenuLabel>
                    {STAFF_BY_TYPE[t.key].map((s) => (
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
                  </DropdownMenuGroup>
                ))}
              </>
            )}
          </Picker>
        </div>
        <Button
          variant="outline"
          disabled={busy || !staff}
          onClick={() => staff && onReopen(row.id, staff.desk, staff.reviewer)}
          aria-label={
            staff
              ? `Refer ${row.studentName} again to ${filedToLabel(staff)}`
              : `Pick staff to refer ${row.studentName} again`
          }
          title={staff ? `Re-submit to ${filedToLabel(staff)}` : undefined}
          className="shrink-0"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : null}
          Refer again
        </Button>
      </div>
    </li>
  );
}

/* Action card: a single action. Clicking New referral slides the form card
   down underneath with student + record dropdowns. The form stays mounted
   once opened so the collapse animates both ways (inert + hidden while
   shut, so keyboard focus can't enter it). */
export function ReferStudentCard() {
  const [formOpen, setFormOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={assign.card} aria-label="Refer a student">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <Send size={20} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>Refer student</h2>
            <p className={styles.sectionDesc}>
              Send an anecdotal record to a desk.
            </p>
          </div>
        </div>
        <div className="relative">
          <Button
            onClick={() => {
              setMounted(true);
              setFormOpen((v) => !v);
            }}
            aria-expanded={formOpen}
            variant={formOpen ? "outline" : "default"}
            className="w-full"
          >
            New referral
          </Button>
        </div>
      </div>
      <div
        className={`${refStyles.collapse} ${formOpen ? refStyles.collapseOpen : ""}`}
        inert={!formOpen}
      >
        <div className={refStyles.collapseInner}>
          {mounted ? <ReferFormCard onDone={() => setFormOpen(false)} /> : null}
        </div>
      </div>
      <DismissedRereferCard />
    </div>
  );
}
