"use client";
import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import sectionStyles from "./settings-section.module.css";
import { useTeacherDataSharing, setDataSharing } from "@/services/settings/data-sharing";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function DataSyncCard() {
  const sharing = useTeacherDataSharing();
  const invalidateTeacher = useTeacherInvalidate();
  const [loading, setLoading] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [optimistic, setOptimistic] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (sharing.data?.shareStudentData !== undefined) setOptimistic(null);
  }, [sharing.data?.shareStudentData]);

  const isOn = optimistic ?? sharing.data?.shareStudentData ?? false;
  const handled = sharing.data?.handledClasses ?? [];
  const updatedAt = sharing.data?.shareUpdatedAt ?? null;
  const previewCount = 3;
  const preview = handled.slice(0, previewCount);
  const remaining = handled.length > previewCount ? handled.length - previewCount : 0;

  const apply = async (next: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      await setDataSharing(next);
      setOptimistic(next);
      setConfirmOff(false);
      invalidateTeacher.overview();
      invalidateTeacher.settings();
      invalidateTeacher.grading();
      invalidateTeacher.advisory();
      toast.success({
        title: next ? "Sharing enabled" : "Sharing disabled",
        description: next
          ? "Your adviser, guidance, and allowed roles now see your grades/attendance in real-time."
          : "Only you see the grades/attendance you encode. Adviser and guidance now see them as hidden.",
      });
    } catch (err) {
      toast.error({ title: "Could not update sharing", description: getErrorMessage(err, "Failed to update sharing.") });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (next: boolean) => {
    if (loading) return;
    if (!next && isOn) {
      setConfirmOff(true);
      return;
    }
    void apply(next);
  };

  return (
    <div id="section-sync" className={sectionStyles.boardWrap}>
      <KanbanBoard
        title="Connect / Sync student data"
        icon={<RefreshCw size={14} aria-hidden="true" />}
        count={sharing.isPending ? undefined : isOn ? "Shared" : "Private"}
        description="Control whether the students you handle in subjects share grades and attendance in real-time."
        ariaLabel="Student data sharing"
      >
        {sharing.isPending ? (
          <div className="flex flex-col gap-2 px-1" aria-busy="true" aria-label="Loading sharing status">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Share my handled students data</p>
                <p className="text-xs text-muted-foreground">
                  {isOn
                    ? "ON — student's adviser, guidance, and allowed roles see your grades/attendance in real-time."
                    : "OFF — only you see the grades/attendance you encode."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {handled.length > 0 ? `${handled.length} class${handled.length === 1 ? "" : "es"} this term` : "No handled classes this term."}
                </p>
                {handled.length > 0 ? (
                  <>
                    <div className={`${sectionStyles.pills} mt-1.5 flex flex-wrap items-center gap-1.5`} aria-label="Handled classes preview">
                      {preview.map((c) => (
                        <span key={`${c.subject}|${c.section}`} className={sectionStyles.pill} title={`${c.subject} — ${c.section}`}>
                          {c.subject} · {c.section}
                        </span>
                      ))}
                      {remaining > 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowAll(true)}
                          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                          aria-haspopup="dialog"
                        >
                          +{remaining} more
                        </button>
                      ) : null}
                    </div>
                    <Dialog open={showAll} onOpenChange={(open) => !open && setShowAll(false)}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Handled classes ({handled.length})</DialogTitle>
                          <DialogDescription>
                            Every class covered by this sharing toggle this term.
                          </DialogDescription>
                        </DialogHeader>
                        <KanbanBoard
                          title={`Handled classes (${handled.length})`}
                          icon={<RefreshCw size={14} aria-hidden="true" className="text-amber-500" />}
                          ariaLabel="All handled classes"
                          className="bg-card"
                          style={{ background: "var(--card)" }}
                        >
                          <div className={`${sectionStyles.pills} flex max-h-60 flex-wrap items-center gap-1.5 overflow-y-auto bg-card px-1 py-1`} role="list" aria-label="Full handled class list">
                            {handled.map((c) => (
                              <span key={`${c.subject}|${c.section}`} role="listitem" className={sectionStyles.pill} title={`${c.subject} — ${c.section}`}>
                                {c.subject} · {c.section}
                              </span>
                            ))}
                          </div>
                        </KanbanBoard>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setShowAll(false)}
                            className={`${sectionStyles.btn} ${sectionStyles.btnDanger}`}
                            autoFocus
                          >
                            Close
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : null}
                {updatedAt ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Last changed: {new Date(updatedAt).toLocaleString()}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Principal, registrar, and record keeper always see official records.
                </p>
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={handleToggle}
                disabled={loading}
                aria-label="Toggle student data sharing"
                className={sectionStyles.amberSwitch}
              />
            </div>
            {confirmOff ? (
              <div className={`flex flex-col gap-2 rounded-lg border border-input p-2.5 ${sectionStyles.reveal}`} role="alertdialog" aria-label="Confirm turn off sharing">
                <p className="text-xs text-muted-foreground">
                  Turn sharing OFF? Your grades and attendance will be hidden from adviser and guidance immediately (retroactive). Only you will see them.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" disabled={loading} onClick={() => setConfirmOff(false)} className={sectionStyles.btn}>
                    Keep ON
                  </Button>
                  <Button type="button" variant="destructive" disabled={loading} onClick={() => void apply(false)} className={`${sectionStyles.btn} ${sectionStyles.btnDanger}`}>
                    {loading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" aria-hidden />
                        <span aria-live="polite">Saving…</span>
                      </>
                    ) : (
                      "Turn OFF"
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </KanbanBoard>
    </div>
  );
}
