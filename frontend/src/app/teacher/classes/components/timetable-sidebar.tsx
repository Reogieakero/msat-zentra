import { Button } from "@/components/ui/button";
import { Info, UserRound } from "lucide-react";
import type { buildTimetableReminder, getReminderMeta } from "./my-timetable-reminder";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

export interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}

export function TimetableSidebar({
  linked,
  isMasterTeacher,
  reminder,
  reminderMeta,
  onReleaseRequest,
}: {
  linked: LinkedName | null;
  isMasterTeacher: boolean;
  reminder: ReturnType<typeof buildTimetableReminder>;
  reminderMeta: ReturnType<typeof getReminderMeta>;
  onReleaseRequest: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
            {linked ? (
            <div className={assign.card} aria-label={`Linked teacher code for ${linked.name}`}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <UserRound size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold" title={`Linked as ${linked.name}`}>
                    Linked as <span className="text-primary underline-offset-4 hover:underline">{linked.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {linked.code ? `${linked.code} · ` : ""}
                    Showing your scheduled subjects and timeslots.
                  </p>
                </div>
              </div>
              <div className="relative">
                <Button
                  variant="link"
                  size="sm"
                  onClick={onReleaseRequest}
                  className="h-auto p-0 text-xs text-destructive"
                >
                  Leave this term
                </Button>
              </div>
            </div>
            ) : isMasterTeacher ? (
              <div className={assign.card} aria-label="Master Teacher access">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col gap-1">
                  <h3 className="font-semibold">Master Teacher — no code needed</h3>
                  <p className="text-xs text-muted-foreground">
                    Your student and subject records open directly. Manage the teacher list and
                    timetables in the Schedule workspace.
                  </p>
                </div>
              </div>
            ) : null}

            <div className={assign.card} aria-label="Slot status legend">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <Info size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Legend</h3>
                  <p className="text-xs text-muted-foreground">
                    What each slot dot means.
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  Submitted — awaiting principal
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                  Approved — official
                </span>
              </div>
            </div>

            {reminder && reminderMeta ? (
              <div
                className={assign.card}
                role="status"
                aria-label={`Class reminder: ${reminder.title} — ${reminder.message}`}
                style={{
                  borderColor: `color-mix(in oklch, ${reminderMeta.from} 45%, transparent)`,
                  background: `linear-gradient(135deg, color-mix(in oklch, ${reminderMeta.from} 26%, var(--card)), color-mix(in oklch, ${reminderMeta.to} 18%, var(--card)))`,
                }}
              >
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${reminderMeta.chip}`}
                    aria-hidden="true"
                  >
                    <reminderMeta.Icon size={20} className={reminderMeta.icon} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{reminder.title}</h3>
                    <p className="text-xs text-muted-foreground">{reminder.message}</p>
                  </div>
                </div>
              </div>
            ) : null}
    </div>
  );
}
