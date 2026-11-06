"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  coordinatorAdmMonitoringKey,
  fetchCoordinatorMonitoringCase,
} from "@/services/teacher/admMonitoring.service";
import { MonitoringHeader } from "@/app/teacher/advisory/adm-cases/[slug]/components/monitoring-header";
import { MonitoringProgress } from "@/app/teacher/advisory/adm-cases/[slug]/components/monitoring-progress";
import { ModulesPanel } from "@/app/teacher/advisory/adm-cases/[slug]/components/modules-panel";
import { MonitoringReport } from "@/app/teacher/advisory/adm-cases/[slug]/components/monitoring-report";
import { ModuleStatus } from "@/app/teacher/advisory/adm-cases/[slug]/components/module-status";
import { MonitoringSkeleton } from "@/app/teacher/advisory/adm-cases/[slug]/components/MonitoringSkeleton";
import styles from "./monitoring.module.css";

const BACK_HREF = "/coordinator/enrolled";

/**
 * Coordinator view of an ADM monitoring case. It reuses the adviser desk's
 * components but stays read-only: modules are released and marked by the
 * adviser, while the coordinator only oversees progress.
 */
export default function CoordinatorAdmMonitoringPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const caseRef = Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : (rawSlug ?? "");

  const monitoringQuery = useQuery({
    queryKey: coordinatorAdmMonitoringKey(caseRef),
    queryFn: ({ signal }) => fetchCoordinatorMonitoringCase(caseRef, signal),
    enabled: Boolean(caseRef),
    retry: false,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  if (!caseRef) {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-sm text-muted-foreground">ADM case not found.</p>
        <Button asChild variant="outline" className="h-7 w-fit px-2.5 text-xs">
          <Link href={BACK_HREF}>Back to enrolled students</Link>
        </Button>
      </div>
    );
  }

  if (monitoringQuery.isPending) return <MonitoringSkeleton />;

  const data = monitoringQuery.data;
  const error = monitoringQuery.error;

  if (error || !data) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-10 text-center">
          <ShieldOff size={28} className="text-muted-foreground" aria-hidden />
          <p role="alert" className="m-0 font-semibold text-foreground">
            {apiErrorMessage(error, "Could not load this ADM case.")}
          </p>
          <p className="m-0 max-w-sm text-xs text-muted-foreground">
            The case may have been removed, or you may not have access to it.
          </p>
          <Button asChild variant="outline" className="h-7 px-2.5 text-xs">
            <Link href={BACK_HREF}>Back to enrolled students</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { header, progress, modules } = data;

  return (
    <div className={`${styles.page} flex w-full flex-col gap-4`}>
      <MonitoringHeader
        header={header}
        backHref={BACK_HREF}
        backLabel="Back to enrolled students"
        backVariant="primary"
      />

      {/* Progress + report + module status: three flat cards in one band. */}
      <div className={`${styles.band} grid min-w-0 items-start gap-4 lg:grid-cols-3`}>
        <MonitoringProgress progress={progress} />
        <MonitoringReport data={data} />
        <ModuleStatus data={data} />
      </div>

      <ModulesPanel modules={modules} />
    </div>
  );
}
