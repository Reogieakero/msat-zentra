"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createAssessment,
  useRefreshAcademic,
} from "@/services/teacher/grading.service";
import type {
  ClassAssessment,
  ClassDetail,
  ComponentType,
} from "@/services/teacher/grading.types";
import { useDock } from "@/components/dock/dock-store";
import type { AddAssessmentSavePhase } from "./AddAssessmentSaveDock";

export interface AddAssessmentSaveInput {
  componentType: ComponentType;
  title: string;
  maxScore: number;
  dateGiven?: string;
  pills: string[];
}

interface AddAssessmentSaveState {
  phase: AddAssessmentSavePhase;
  message: string | null;
  title: string | null;
  pills: string[];
}

type SaveResult =
  | { ok: true; created: ClassAssessment }
  | { ok: false; message: string };

interface AddAssessmentSaveValue {
  saveState: AddAssessmentSaveState | null;
  saveAssessment: (assignmentId: string, input: AddAssessmentSaveInput) => Promise<SaveResult>;
  dismissSave: () => void;
}

const AddAssessmentSaveContext = React.createContext<AddAssessmentSaveValue | null>(null);

export function useAddAssessmentSave(): AddAssessmentSaveValue {
  const ctx = React.useContext(AddAssessmentSaveContext);
  if (!ctx) throw new Error("useAddAssessmentSave must be used inside AddAssessmentSaveProvider");
  return ctx;
}

export function AddAssessmentSaveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const refreshAcademic = useRefreshAcademic();
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [save, setSave] = React.useState<AddAssessmentSaveState | null>(null);
  const dismissSave = React.useCallback(() => {
    setSave(null);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "assessment-add" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const saveAssessment = React.useCallback(
    async (assignmentId: string, input: AddAssessmentSaveInput): Promise<SaveResult> => {
      setSave({ phase: "adding", message: `Adding "${input.title}"…`, title: input.title, pills: input.pills });
      let taskId: string | null = null;
      try {
        taskId = dockRef.current.startTask({ kind: "assessment-add", title: "Adding assessment", description: input.title });
      } catch {
        taskId = null;
      }
      try {
        const created = await createAssessment(assignmentId, {
          componentType: input.componentType,
          title: input.title,
          maxScore: input.maxScore,
          dateGiven: input.dateGiven,
        });
        queryClient.setQueriesData<ClassDetail>(
          { queryKey: ["teacher-grading-class"] },
          (prev) => {
            if (!prev || prev.assignment.id !== assignmentId) return prev;
            return {
              ...prev,
              components: prev.components.map((c) =>
                c.type === input.componentType ? { ...c, assessments: [...c.assessments, created] } : c,
              ),
            };
          },
        );
        queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
        refreshAcademic();
        setSave({ phase: "added", message: `"${created.title}" is ready for score encoding.`, title: created.title, pills: input.pills });
        try {
          if (taskId) dockRef.current.completeTask(taskId, `${created.title} · ready for encoding`);
        } catch {
          /* ignore */
        }
        return { ok: true as const, created };
      } catch {
        const message = "Could not add the assessment — check your connection and try again.";
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

  const value = React.useMemo(() => ({ saveState: save, saveAssessment, dismissSave }), [save, saveAssessment, dismissSave]);

  return <AddAssessmentSaveContext.Provider value={value}>{children}</AddAssessmentSaveContext.Provider>;
}
