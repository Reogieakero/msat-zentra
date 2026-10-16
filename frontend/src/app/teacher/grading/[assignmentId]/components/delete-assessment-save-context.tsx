"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  deleteAssessment,
  useRefreshAcademic,
} from "@/services/teacher/grading.service";
import type { ClassDetail } from "@/services/teacher/grading.types";
import { useDock } from "@/components/dock/dock-store";
import type { DeleteAssessmentSavePhase } from "./DeleteAssessmentSaveDock";

export interface DeleteAssessmentSaveInput {
  title: string;
  pills: string[];
}

interface DeleteAssessmentSaveState {
  phase: DeleteAssessmentSavePhase;
  message: string | null;
  title: string | null;
  pills: string[];
}

type DeleteResult = { ok: true } | { ok: false; message: string };

interface DeleteAssessmentSaveValue {
  saveState: DeleteAssessmentSaveState | null;
  deleteAssessmentFlow: (assessmentId: string, input: DeleteAssessmentSaveInput) => Promise<DeleteResult>;
  dismissDeleteSave: () => void;
}

const DeleteAssessmentSaveContext = React.createContext<DeleteAssessmentSaveValue | null>(null);

export function useDeleteAssessmentSave(): DeleteAssessmentSaveValue {
  const ctx = React.useContext(DeleteAssessmentSaveContext);
  if (!ctx) throw new Error("useDeleteAssessmentSave must be used inside DeleteAssessmentSaveProvider");
  return ctx;
}

export function DeleteAssessmentSaveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const refreshAcademic = useRefreshAcademic();
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [save, setSave] = React.useState<DeleteAssessmentSaveState | null>(null);
  const dismissDeleteSave = React.useCallback(() => {
    setSave(null);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "assessment-delete" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const deleteAssessmentFlow = React.useCallback(
    async (assessmentId: string, input: DeleteAssessmentSaveInput): Promise<DeleteResult> => {
      setSave({ phase: "deleting", message: `Deleting "${input.title}"…`, title: input.title, pills: input.pills });
      let taskId: string | null = null;
      try {
        taskId = dockRef.current.startTask({ kind: "assessment-delete", title: "Deleting assessment", description: input.title });
      } catch {
        taskId = null;
      }
      try {
        await deleteAssessment(assessmentId);
        queryClient.setQueriesData<ClassDetail>(
          { queryKey: ["teacher-grading-class"] },
          (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              components: prev.components.map((c) => ({
                ...c,
                assessments: c.assessments.filter((a) => a.id !== assessmentId),
              })),
            };
          },
        );
        queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
        refreshAcademic();
        setSave({ phase: "deleted", message: `"${input.title}" and its scores were removed.`, title: input.title, pills: input.pills });
        try {
          if (taskId) dockRef.current.completeTask(taskId, `${input.title} · deleted`);
        } catch {
          /* ignore */
        }
        return { ok: true as const };
      } catch {
        const message = "Could not delete the assessment — check your connection and try again.";
        setSave((prev) => ({ phase: "error" as const, message, title: prev?.title ?? input.title, pills: prev?.pills ?? input.pills }));
        try {
          if (taskId) dockRef.current.failTask(taskId, message);
        } catch {
          /* ignore */
        }
        return { ok: false as const, message };
      }
    },
    [queryClient, refreshAcademic],
  );

  const value = React.useMemo(
    () => ({ saveState: save, deleteAssessmentFlow, dismissDeleteSave }),
    [save, deleteAssessmentFlow, dismissDeleteSave],
  );

  return <DeleteAssessmentSaveContext.Provider value={value}>{children}</DeleteAssessmentSaveContext.Provider>;
}
