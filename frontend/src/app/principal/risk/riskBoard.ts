import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

export type RiskLevelKey = "High" | "Moderate" | "Low";

export interface RiskBoardData {
  kpis: {
    totalAtRiskFlags: number;
    highRiskStudents: number;
  };
  levelDistribution: { level: RiskLevelKey; count: number }[];
  factorTotals: { Academic: number; Attendance: number; Behavioral: number };
  interventionOutcome: {
    ongoing: number;
    resolved: number;
    unresolved: number;
  };
  trend: { term: string; high: number; moderate: number; low: number }[];
}

export async function fetchRiskBoard(): Promise<RiskBoardData> {
  const { data } = await apiClient.get<RiskBoardData>("/api/risk/board");
  return data;
}

export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface HeatmapSection {
  sectionId: string;
  section: string;
  gradeLevel: string;
  factors: Record<RiskFactor, number>;
}

export interface HeatmapData {
  termId: string;
  sections: HeatmapSection[];
  factorTotals: Record<RiskFactor, number>;
}

export interface HeatmapStudent {
  lrn: string;
  name: string;
  riskLevel: RiskLevelKey;
  factor: RiskFactor;
}

export async function fetchRiskHeatmap(): Promise<HeatmapData> {
  const { data } = await apiClient.get<HeatmapData>("/api/risk/heatmap");
  return data;
}

export async function fetchSectionFactorStudents(
  sectionId: string,
  factor: RiskFactor,
  termId: string
): Promise<HeatmapStudent[]> {
  const { data } = await apiClient.get<{ students: HeatmapStudent[] }>(
    `/api/risk/sections/${sectionId}/students`,
    { params: { termId, factor } }
  );
  return data.students;
}

export interface LowRiskStudent {
  lrn: string;
  name: string;
}

export interface LowRiskResult {
  students: LowRiskStudent[];
  total: number;
  page: number;
  pageSize: number;
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

export function useRiskHeatmap() {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRiskHeatmap()
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
  }, []);

  return { data, loading, error };
}

export function useRiskBoard() {
  const [data, setData] = useState<RiskBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRiskBoard()
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
  }, []);

  return { data, loading, error };
}
