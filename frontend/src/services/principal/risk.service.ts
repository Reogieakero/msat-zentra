// Principal risk-board reads + local fetch-state hooks.
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import type {
  HeatmapData,
  HeatmapStudent,
  LowRiskResult,
  LowRiskStudent,
  RiskBoardData,
  RiskFactor,
} from "./risk.types";

export async function fetchRiskBoard(gradeMode: "raw" | "final" = "final"): Promise<RiskBoardData> {
  const { data } = await apiClient.get<RiskBoardData>("/api/risk/board", {
    params: { gradeMode },
  });
  return data;
}

export async function fetchRiskHeatmap(gradeMode: "raw" | "final" = "final"): Promise<HeatmapData> {
  const { data } = await apiClient.get<HeatmapData>("/api/risk/heatmap", {
    params: { gradeMode },
  });
  return data;
}

export async function fetchSectionFactorStudents(
  sectionId: string,
  factor: RiskFactor,
  termId: string,
  gradeMode: "raw" | "final" = "final"
): Promise<HeatmapStudent[]> {
  const { data } = await apiClient.get<{ students: HeatmapStudent[] }>(
    `/api/risk/sections/${sectionId}/students`,
    { params: { termId, factor, gradeMode } }
  );
  return data.students;
}

export async function fetchLowRiskStudents(
  page: number,
  pageSize = 15
): Promise<LowRiskResult> {
  const { data } = await apiClient.get<LowRiskResult>("/api/risk/low-risk-students", {
    params: { page, pageSize },
  });
  return data;
}

export function useLowRiskStudents(pageSize = 15) {
  const [students, setStudents] = useState<LowRiskStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLowRiskStudents(page, pageSize)
      .then((res) => {
        if (!cancelled) {
          setStudents(res.students);
          setTotal(res.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load low-risk students (HTTP ${status})`
              : "Failed to load low-risk students"
          );
          console.error("[/api/risk/low-risk-students] fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { students, total, page, totalPages, setPage, loading, error };
}

export function useRiskHeatmap(gradeMode: "raw" | "final" = "final") {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRiskHeatmap(gradeMode)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load heat map (HTTP ${status})`
              : "Failed to load heat map"
          );
          console.error("[/api/risk/heatmap] fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeMode]);

  return { data, loading, error };
}

export function useRiskBoard(gradeMode: "raw" | "final" = "final") {
  const [data, setData] = useState<RiskBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRiskBoard(gradeMode)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load risk board (HTTP ${status})`
              : "Failed to load risk board"
          );
          console.error("[/api/risk/board] fetch failed:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeMode]);

  return { data, loading, error };
}
