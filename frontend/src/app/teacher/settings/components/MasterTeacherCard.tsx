"use client";
import * as React from "react";
import { GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { toast } from "@/components/ui/sonner";
import sectionStyles from "./settings-section.module.css";
import { useCachedMasterTeacher, writeCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export function MasterTeacherCard() {
  const session = useSession();
  const overview = useTeacherOverview();
  const invalidateTeacher = useTeacherInvalidate();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  // Optimistic override so the switch + sidebar Timeslot link flip instantly.
  // overview.data stays stale (old `false`) until the refetch below lands, and
  // `overview.data?.isMasterTeacher ?? cachedMaster` would otherwise keep
  // showing off even after we write the cache.
  const [optimistic, setOptimistic] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (overview.data?.isMasterTeacher !== undefined) setOptimistic(null);
  }, [overview.data?.isMasterTeacher]);
  const isMasterTeacher = optimistic ?? overview.data?.isMasterTeacher ?? cachedMaster;
  const masterTeacherEligible = overview.data?.masterTeacherEligible ?? false;
  const masterTeacherTaken = overview.data?.masterTeacherTaken ?? false;
  const masterHolderName = overview.data?.masterTeacherHolderName ?? null;
  const takenByOther = !isMasterTeacher && masterTeacherTaken;
  const [mtLoading, setMtLoading] = React.useState(false);
  if (!masterTeacherEligible) return null;
  const handleToggleMasterTeacher = async () => {
    if (mtLoading) return;
    const next = !isMasterTeacher;
    if (next && takenByOther) {
      toast.error({
        title: "Designation unavailable",
        description: masterHolderName
          ? `Master Teacher is currently designated by ${masterHolderName} — try again after it is turned off.`
          : "Master Teacher is currently designated — try again after it is turned off.",
      });
      return;
    }
    setMtLoading(true);
    try {
      await apiClient.patch("/api/teacher/settings/master-teacher", { isMasterTeacher: next });
      writeCachedMasterTeacher(session?.sub, next);
      setOptimistic(next);
      // settings() alone only refreshes adviser-sections — overview holds
      // isMasterTeacher (card + sidebar Timeslot link) and schedule-me/my-slots
      // gate the timetable, so all three must refresh or the toast pops with
      // no visible change.
      invalidateTeacher.overview();
      invalidateTeacher.schedule();
      invalidateTeacher.settings();
      toast.success({
        title: next ? "Master Teacher enabled" : "Master Teacher disabled",
        description: next
          ? "Your classes now appear under the Master Teacher designation."
          : "You no longer have the Master Teacher designation.",
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to update Master Teacher status.");
      toast.error({ title: "Could not update status", description: message });
      invalidateTeacher.overview();
      invalidateTeacher.settings();
    } finally {
      setMtLoading(false);
    }
  };
  return (
    <div id="section-master-teacher" className={sectionStyles.boardWrap}>
      <KanbanBoard
        title="Master Teacher"
        icon={<GraduationCap size={14} aria-hidden="true" />}
        description="Self-declared designation for grades 7–10 classes."
        ariaLabel="Master Teacher settings"
      >
        {isMasterTeacher ? (
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-medium">Master Teacher status</p>
              <p className="text-xs text-muted-foreground">
                Currently designated — only one designation at a time.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No teacher code is needed on My Classes / Attendance while designated —
                your student and subject records open directly. Turn off to release the seat.
              </p>
            </div>
            <Switch
              checked
              onCheckedChange={handleToggleMasterTeacher}
              disabled={mtLoading}
              aria-label="Toggle Master Teacher status"
              className={sectionStyles.amberSwitch}
            />
          </div>
        ) : takenByOther ? (
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-medium">Master Teacher status</p>
              <p className="text-xs text-muted-foreground">
                {masterHolderName
                  ? `Currently designated by ${masterHolderName} — unavailable until released.`
                  : "Currently designated — unavailable until released."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the code from the master teacher&apos;s teacher list on My Classes /
                Attendance to attach your student and subject records.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-medium">Master Teacher status</p>
              <p className="text-xs text-muted-foreground">Not designated</p>
            </div>
            <Switch
              checked={false}
              onCheckedChange={handleToggleMasterTeacher}
              disabled={mtLoading}
              aria-label="Toggle Master Teacher status"
              className={sectionStyles.amberSwitch}
            />
          </div>
        )}
      </KanbanBoard>
    </div>
  );
}
