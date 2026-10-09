"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import refStyles from "./referrals.module.css";
import { useReopenReferral } from "./use-reopen-referral";
import { ReferPicker } from "./refer-picker";
import {
  DESK_LABELS,
  REFERRAL_TYPES,
  STAFF_BY_TYPE,
  filedToLabel,
  findStaff,
} from "./referral-types";
interface DismissedMine {
  id: string;
  studentName: string;
  lrn: string;
  targetRole: string;
  status: string;
  track: "adm" | "general";
}
function DismissedRow({
  row,
  busy,
  onReopen,
  onReferAgain,
}: {
  row: DismissedMine;
  busy: boolean;
  onReopen?: (id: string, desk: string, reviewer: string | null) => void;
  onReferAgain?: () => void;
}) {
  const [staffValue, setStaffValue] = React.useState("");
  const staff = staffValue ? findStaff(staffValue) : null;
  const isAdm = row.track === "adm";
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
          <ReferPicker
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
          </ReferPicker>
        </div>
        {isAdm ? (
          <Button
            variant="outline"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => onReferAgain?.()}
            aria-label={`Start new referral for ${row.studentName}`}
            title={`Start new referral for ${row.studentName}`}
            className="shrink-0"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            {busy ? "Re-submitting…" : "Refer again"}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy || !staff}
            aria-busy={busy || undefined}
            onClick={() => staff && onReopen?.(row.id, staff.desk, staff.reviewer)}
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
            {busy ? "Re-submitting…" : "Refer again"}
          </Button>
        )}
      </div>
    </li>
  );
}
export function DismissedRereferCard({
  onOpenChange,
  onAdmRerefer,
}: {
  onOpenChange: (open: boolean) => void;
  onAdmRerefer?: () => void;
}) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const mineQuery = useQuery<DismissedMine[]>({
    queryKey: ["myReferrals", "dismissed", termKey],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<
        DismissedMine[] | { referrals: DismissedMine[] }
      >("/api/referrals/mine?page=1&pageSize=15", { signal });
      if (Array.isArray(data)) return data;
      const rows = (data as { referrals?: unknown }).referrals;
      return Array.isArray(rows) ? (rows as DismissedMine[]) : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
  const { reopen, isPending } = useReopenReferral();
  const [reopenRowId, setReopenRowId] = React.useState<string | null>(null);
  const dismissed = React.useMemo(
    () =>
      (Array.isArray(mineQuery.data) ? mineQuery.data : []).filter(
        (r) => r.status === "dismissed"
      ),
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
            r.track === "adm" ? (
              <DismissedRow
                key={r.id}
                row={r}
                busy={isPending}
                onReferAgain={() => {
                  onOpenChange(true);
                  onAdmRerefer?.();
                }}
              />
            ) : (
              <DismissedRow
                key={r.id}
                row={r}
                busy={reopenRowId !== null && reopenRowId === r.id}
                onReopen={(id, desk, reviewer) => {
                  setReopenRowId(id);
                  void reopen(
                    { id },
                    { referredToRole: desk, ...(reviewer ? { consultReviewer: reviewer } : {}) },
                  ).finally(() => {
                    setReopenRowId((prev) => (prev === id ? null : prev));
                  });
                }}
              />
            )
          ))}
        </ul>
      )}
    </div>
  );
}
