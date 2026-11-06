"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KanbanOverlay, KanbanPill } from "@/components/ui/kanban-overlay";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { useDock } from "@/components/dock/dock-store";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";

export interface CertSheetContext {
  profileId: string;
  student: string;
  hasReferral: boolean;
  hasAnecdotal: boolean;
  meetingAttended: boolean;
}

interface CertificationSheetProps {
  open: boolean;
  context: CertSheetContext | null;
  onClose: () => void;
  onCertified: () => void;
}

/**
 * Kanban-style ADM certification overlay. Confirming closes it at once —
 * the shared Dock in the bottom-right reports the request until it settles.
 */
export function CertificationSheet({
  open,
  context,
  onClose,
  onCertified,
}: CertificationSheetProps) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [recommendation, setRecommendation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const openKey = open && context ? context.profileId : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setRecommendation("");
    setError(null);
  }

  const certifyMutation = useMutation({
    mutationFn: async ({
      profileId,
      text,
    }: {
      profileId: string;
      text: string;
      taskId: string | null;
    }) => {
      const { data } = await apiClient.post(
        `/api/adm/${profileId}/certification`,
        { recommendation: text },
      );
      return data;
    },
    onSuccess: (data, vars) => {
      void data;
      markSelfNotified(vars.profileId);
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-certifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-dashboard"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-referrals"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-notifications"],
      });
      if (vars.taskId) {
        dock.completeTask(vars.taskId, "Certification → Principal");
      }
      onCertified();
    },
    onError: (err, vars) => {
      if (vars.taskId) dock.failTask(vars.taskId, apiErrorMessage(err));
      toast.error({
        title: "Could not record certification",
        description: apiErrorMessage(err),
      });
    },
  });

  function save() {
    if (certifyMutation.isPending || !context) return;
    if (recommendation.trim().length < 10) {
      setError("Write the recommendation (at least 10 characters).");
      return;
    }
    setError(null);
    const profileId = context.profileId;
    // Close at once — the shared Dock reports the request until it settles.
    onClose();
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Recording certification",
        description: `${context.student} → Principal`,
      });
    } catch {
      taskId = null;
    }
    certifyMutation.mutate({
      profileId,
      text: recommendation.trim(),
      taskId,
    });
  }

  const evidence = context
    ? [
        { label: "Referral on file", ok: context.hasReferral },
        { label: "Anecdotal report on file", ok: context.hasAnecdotal },
        { label: "Parent meeting attended", ok: context.meetingAttended },
      ]
    : [];
  const missing = evidence.filter((e) => !e.ok);

  return (
    <KanbanOverlay
      open={open}
      onClose={onClose}
      dismissable={!certifyMutation.isPending}
      title="ADM certification"
      icon={
        <span className="text-primary" aria-hidden>
          <BadgeCheck size={14} />
        </span>
      }
      width="lg"
      description={
        context
          ? `Recommendation for ${context.student} — creating it passes the case to the Principal for signature.`
          : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            type="button"
            size="sm"
            className="h-6 px-3 text-xs"
            onClick={save}
            disabled={certifyMutation.isPending}
            autoFocus
          >
            Create certification
          </Button>
        </div>
      }
    >
      {context ? (
        <div className="flex flex-col gap-3">
          <KanbanBoard title="Evidence chain" className="border-border/70">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {evidence.map((e) => (
                <li key={e.label} className="flex items-center gap-2 px-1">
                  <KanbanPill tone={e.ok ? "success" : "danger"}>
                    {e.ok ? "On file" : "Missing"}
                  </KanbanPill>
                  <span className="text-xs text-muted-foreground">
                    {e.label}
                  </span>
                </li>
              ))}
            </ul>
          </KanbanBoard>

          <div className="flex flex-col gap-1.5 px-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cert-recommendation"
            >
              Recommendation
            </label>
            <Textarea
              id="cert-recommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="State the findings and the ADM recommendation…"
              rows={5}
            />
          </div>

          {missing.length > 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              Missing evidence flags the case for revision — you can still
              certify now and complete it after.
            </p>
          ) : null}

          {error ? (
            <p className="px-1 text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
