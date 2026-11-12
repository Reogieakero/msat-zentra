"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import { AttendanceSummary } from "./components/AttendanceSummary";
import { SchoolTrend } from "./components/SchoolTrend";
import styles from "./components/attendance.module.css";

const SHARED_PARAMS = { sharedOnly: true } as const;

export default function PrincipalAttendanceHeatmapsPage() {
  // Same key/params as AttendanceSummary, so this reads its cache. The page
  // empty state lives here instead of inside the boards' data tables.
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-averages", "shared"],
    queryFn: async () => {
      const res = await apiClient.get<{ sections: { sectionId: string; rate: number }[] }>(
        "/api/attendance/section-stats",
        { params: SHARED_PARAMS },
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isEmpty = !isPending && (data?.sections ?? []).length === 0;

  return (
    <section className={styles.page}>
      {isEmpty ? (
        <PageEmptyCallout>
          No attendance data for adviser-shared sections in the active term yet.
          Records will appear here once school days elapse.
        </PageEmptyCallout>
      ) : (
        <>
          <AttendanceSummary />
          <div className={styles.stack}>
            <SchoolTrend />
          </div>
        </>
      )}
    </section>
  );
}
