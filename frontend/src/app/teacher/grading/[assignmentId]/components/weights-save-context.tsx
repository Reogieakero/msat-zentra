"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyWeightPreset,
  saveComponentWeight,
  useRefreshAcademic,
} from "@/services/teacher/grading.service";
import type {
  ClassDetail,
  ComponentType,
  WeightPreset,
} from "@/services/teacher/grading.types";
import { useDock } from "@/components/dock/dock-store";
import type { WeightsSavePhase } from "./WeightsSaveDock";

export interface WeightsSaveInput {
  weights: { type: ComponentType; value: number }[];
}

interface WeightsSaveState {
  phase: WeightsSavePhase;
  message: string | null;
  pills: string[];
}

type WeightsResult = { ok: true } | { ok: false; message: string };

const ORDER: ComponentType[] = ["WRITTEN_WORK", "PERFORMANCE_TASK", "EXAM"];
const CODE: Record<ComponentType, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

const PRESET_WEIGHTS: Record<WeightPreset, { type: ComponentType; value: number }[]> = {
  SHS: [
    { type: "WRITTEN_WORK", value: 25 },
    { type: "PERFORMANCE_TASK", value: 45 },
    { type: "EXAM", value: 30 },
  ],
  JHS_LANG: [
    { type: "WRITTEN_WORK", value: 30 },
    { type: "PERFORMANCE_TASK", value: 50 },
    { type: "EXAM", value: 20 },
  ],
  JHS_MATH_SCI: [
    { type: "WRITTEN_WORK", value: 40 },
    { type: "PERFORMANCE_TASK", value: 40 },
    { type: "EXAM", value: 20 },
  ],
  JHS_MAPEH_TLE: [
    { type: "WRITTEN_WORK", value: 20 },
    { type: "PERFORMANCE_TASK", value: 60 },
    { type: "EXAM", value: 20 },
  ],
};

function pillsFor(weights: { type: ComponentType; value: number }[]): string[] {
  const byType = new Map(weights.map((w) => [w.type, w.value]));
  return ORDER.map((t) => `${CODE[t]} ${byType.get(t) ?? 0}`);
}

interface WeightsSaveValue {
  saveState: WeightsSaveState | null;
  saveWeights: (assignmentId: string, input: WeightsSaveInput) => Promise<WeightsResult>;
  applyPreset: (assignmentId: string, preset: WeightPreset) => Promise<WeightsResult>;
  dismissWeightsSave: () => void;
}

const WeightsSaveContext = React.createContext<WeightsSaveValue | null>(null);

export function useWeightsSave(): WeightsSaveValue {
  const ctx = React.useContext(WeightsSaveContext);
  if (!ctx) throw new Error("useWeightsSave must be used inside WeightsSaveProvider");
  return ctx;
}

function patchWeights(
  queryClient: ReturnType<typeof useQueryClient>,
  assignmentId: string,
  weights: { type: ComponentType; value: number }[],
) {
  const byType = new Map(weights.map((w) => [w.type, w.value]));
  queryClient.setQueriesData<ClassDetail>(
    { queryKey: ["teacher-grading-class"] },
    (prev) => {
      if (!prev || prev.assignment.id !== assignmentId) return prev;
      return {
        ...prev,
        components: prev.components.map((c) =>
          byType.has(c.type) ? { ...c, weight: byType.get(c.type)! } : c,
        ),
      };
    },
  );
}

// Weights saves now report into the single shared Dock.
export function WeightsSaveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const refreshAcademic = useRefreshAcademic();
  const dock = useDock();
  const dockRef = React.useRef(dock);
  React.useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [save, setSave] = React.useState<WeightsSaveState | null>(null);

  const dismissWeightsSave = React.useCallback(() => {
    setSave(null);
    try {
      for (const t of dockRef.current.tasks) {
        if (t.kind === "weights-save" && t.status !== "running" && t.status !== "waiting") {
          dockRef.current.dismissTask(t.id);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const runWeights = React.useCallback(
    async (label: string, pills: string[], work: () => Promise<void>): Promise<WeightsResult> => {
      setSave({ phase: "saving", message: label, pills });
      let taskId: string | null = null;
      try {
        taskId = dockRef.current.startTask({ kind: "weights-save", title: "Saving weights", description: label });
      } catch {
        taskId = null;
      }
      try {
        await work();
      } catch {
        const message = "Some weights failed — please retry.";
        setSave((prev) => ({ phase: "error" as const, message, pills: prev?.pills ?? pills }));
        try {
          if (taskId) dockRef.current.failTask(taskId, message);
        } catch {
          /* ignore */
        }
        return { ok: false as const, message };
      }
      const doneMessage = "Category weights now total 100%.";
      setSave({ phase: "saved", message: doneMessage, pills });
      try {
        if (taskId) dockRef.current.completeTask(taskId, `${pills.join(" · ")}`);
      } catch {
        /* ignore */
      }
      return { ok: true as const };
    },
    [],
  );

  const saveWeights = React.useCallback(
    async (assignmentId: string, input: WeightsSaveInput): Promise<WeightsResult> => {
      const pills = pillsFor(input.weights);
      const result = await runWeights("Applying weights…", pills, async () => {
        const results = await Promise.allSettled(
          input.weights.map((w) =>
            saveComponentWeight(assignmentId, { componentType: w.type, weightPercentage: w.value }),
          ),
        );
        if (results.some((r) => r.status === "rejected")) throw new Error("weights-failed");
        patchWeights(queryClient, assignmentId, input.weights);
        queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
        refreshAcademic();
      });
      return result;
    },
    [queryClient, refreshAcademic, runWeights],
  );

  const applyPreset = React.useCallback(
    async (assignmentId: string, preset: WeightPreset): Promise<WeightsResult> => {
      const weights = PRESET_WEIGHTS[preset];
      const pills = pillsFor(weights);
      const result = await runWeights("Applying DepEd standard weights…", pills, async () => {
        await applyWeightPreset(assignmentId, preset);
        patchWeights(queryClient, assignmentId, weights);
        queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
        refreshAcademic();
      });
      if (!result.ok) {
        const message = "The DepEd preset was not applied — check your connection and retry.";
        setSave((prev) => ({ phase: "error" as const, message, pills: prev?.pills ?? pills }));
        return { ok: false as const, message };
      }
      setSave({ phase: "saved", message: "DepEd standard weights are now active.", pills });
      return { ok: true as const };
    },
    [queryClient, refreshAcademic, runWeights],
  );

  const value = React.useMemo(
    () => ({ saveState: save, saveWeights, applyPreset, dismissWeightsSave }),
    [save, saveWeights, applyPreset, dismissWeightsSave],
  );

  return <WeightsSaveContext.Provider value={value}>{children}</WeightsSaveContext.Provider>;
}
