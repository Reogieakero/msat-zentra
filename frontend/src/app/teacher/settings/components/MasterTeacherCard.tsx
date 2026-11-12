"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { toast } from "@/components/ui/sonner";
import sectionStyles from "./settings-section.module.css";
import { useCachedMasterTeacher, writeCachedMasterTeacher } from "@/services/teacher/flagCache";
import { teacherOverviewKey, useTeacherOverview } from "@/services/teacher/overview.service";
import type { TeacherOverviewCritical } from "@/services/teacher/overview.types";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import { useSettingsDockAction } from "./use-settings-dock";

type MasterTeacherBand = "7-10" | "11-12";

interface SeatConfig {
  band: MasterTeacherBand;
  label: string;
  grades: string;
}

const SEATS: SeatConfig[] = [
  { band: "7-10", label: "Junior High", grades: "Grades 7–10" },
  { band: "11-12", label: "Senior High", grades: "Grades 11–12" },
];

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function MasterTeacherCard() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { activeTerm } = useTerm();
  const overview = useTeacherOverview();
  const invalidateTeacher = useTeacherInvalidate();
  const runDockAction = useSettingsDockAction();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  // Optimistic overrides so each switch + the sidebar Timeslot link flip
  // instantly; overview.data stays stale until the refetch lands.
  const [optimistic, setOptimistic] = React.useState<Partial<Record<MasterTeacherBand, boolean>>>({});
  const [loading, setLoading] = React.useState<Partial<Record<MasterTeacherBand, boolean>>>({});
  React.useEffect(() => {
    if (overview.data?.isMasterTeacher === undefined) return;
    setOptimistic((prev) =>
      prev["7-10"] === undefined && prev["11-12"] === undefined ? prev : {},
    );
  }, [overview.data?.isMasterTeacher, overview.data?.isMasterTeacherSenior]);

  const seats = SEATS.map((seat) => {
    const data = overview.data;
    const isMasterTeacher =
      optimistic[seat.band] ??
      (seat.band === "11-12"
        ? (data?.isMasterTeacherSenior ?? false)
        : (data?.isMasterTeacher ?? cachedMaster));
    const eligible =
      seat.band === "11-12"
        ? (data?.masterTeacherSeniorEligible ?? false)
        : (data?.masterTeacherEligible ?? false);
    const taken =
      seat.band === "11-12"
        ? (data?.masterTeacherSeniorTaken ?? false)
        : (data?.masterTeacherTaken ?? false);
    const holderName =
      seat.band === "11-12"
        ? (data?.masterTeacherSeniorHolderName ?? null)
        : (data?.masterTeacherHolderName ?? null);
    return { ...seat, isMasterTeacher, eligible, taken, holderName };
  });
  // Both band seats stay visible so a teacher can see which seat exists and
  // whether their current load qualifies — never hide the G11–12 row just
  // because this teacher has no senior classes this term.
  const visibleSeats = seats;
  if (visibleSeats.length === 0) return null;

  const handleToggle = async (seat: (typeof seats)[number]) => {
    if (loading[seat.band]) return;
    const next = !seat.isMasterTeacher;
    const takenByOther = !seat.isMasterTeacher && seat.taken;
    if (next && takenByOther) {
      toast.error({
        title: "Designation unavailable",
        description: seat.holderName
          ? `${seat.grades} Master Teacher is currently designated by ${seat.holderName} — try again after it is turned off.`
          : `${seat.grades} Master Teacher is currently designated — try again after it is turned off.`,
      });
      return;
    }
    setLoading((prev) => ({ ...prev, [seat.band]: true }));
    try {
      await runDockAction(
        {
          title: next
            ? `Enabling ${seat.grades} Master Teacher`
            : `Disabling ${seat.grades} Master Teacher`,
          description: seat.label,
        },
        async () => {
          await apiClient.patch("/api/teacher/settings/master-teacher", {
            isMasterTeacher: next,
            band: seat.band,
          });
        },
        {
          doneDescription: next
            ? `${seat.grades} Master Teacher enabled`
            : `${seat.grades} Master Teacher disabled`,
        },
      );
      const nextJunior =
        seat.band === "7-10" ? next : (overview.data?.isMasterTeacher ?? false);
      const nextSenior =
        seat.band === "11-12" ? next : (overview.data?.isMasterTeacherSenior ?? false);
      writeCachedMasterTeacher(session?.sub, nextJunior || nextSenior);
      setOptimistic((prev) => ({ ...prev, [seat.band]: next }));
      // Write the new seat flags straight into the overview cache so the
      // sidebar, card and every overview consumer flip instantly — no full
      // page refresh, no waiting on the refetch/Redis TTL.
      queryClient.setQueryData<TeacherOverviewCritical>(
        teacherOverviewKey(
          session?.sub,
          `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`,
        ),
        (prev) =>
          prev
            ? {
                ...prev,
                isMasterTeacher: nextJunior,
                isMasterTeacherSenior: nextSenior,
              }
            : prev,
      );
      // settings() alone only refreshes adviser-sections — overview holds
      // the seat flags (card + sidebar Timeslot link) and schedule-me/my-slots
      // gate the timetable, so all three must refresh.
      invalidateTeacher.overview();
      invalidateTeacher.schedule();
      invalidateTeacher.settings();
      toast.success({
        title: next
          ? `${seat.grades} Master Teacher enabled`
          : `${seat.grades} Master Teacher disabled`,
        description: next
          ? `Your ${seat.label} classes now appear under the ${seat.grades} Master Teacher designation.`
          : `You no longer hold the ${seat.grades} Master Teacher designation.`,
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update Master Teacher status.");
      toast.error({ title: "Could not update status", description: message });
      invalidateTeacher.overview();
      invalidateTeacher.settings();
    } finally {
      setLoading((prev) => ({ ...prev, [seat.band]: false }));
    }
  };

  return (
    <div id="section-master-teacher" className={sectionStyles.boardWrap}>
      <KanbanBoard
        title="Master Teacher"
        icon={<GraduationCap size={14} aria-hidden="true" />}
        description="One designation per grade band — each seat owns its own timeslot scope."
        ariaLabel="Master Teacher settings"
      >
        <div className="flex flex-col divide-y divide-border/60">
          {visibleSeats.map((seat) => {
            const takenByOther = !seat.isMasterTeacher && seat.taken;
            const notEligible = !seat.eligible && !seat.isMasterTeacher;
            return (
              <div key={seat.band} className="flex items-center justify-between gap-3 px-1 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">
                    {seat.label} <span className="text-muted-foreground">· {seat.grades}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {seat.isMasterTeacher
                      ? "Currently designated — only one holder per band."
                      : notEligible
                        ? "Not available — no classes in this grade band this term."
                        : takenByOther
                          ? seat.holderName
                            ? `Currently designated by ${seat.holderName} — unavailable until released.`
                            : "Currently designated — unavailable until released."
                          : "Not designated"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {seat.isMasterTeacher
                      ? "No teacher code is needed on My Classes / Attendance while designated — your timeslot shows only this band."
                      : notEligible
                        ? `You need at least one ${seat.grades} class or advisory section this term to hold this seat.`
                        : takenByOther
                          ? "Enter the code from this band's master teacher list on My Classes / Attendance to attach records."
                          : `Turn on to manage ${seat.grades} sections and timeslots.`}
                  </p>
                </div>
                <Switch
                  checked={seat.isMasterTeacher}
                  onCheckedChange={() => handleToggle(seat)}
                  disabled={!!loading[seat.band] || takenByOther || notEligible}
                  aria-label={`Toggle ${seat.grades} Master Teacher status`}
                  className={sectionStyles.amberSwitch}
                />
              </div>
            );
          })}
        </div>
      </KanbanBoard>
    </div>
  );
}
