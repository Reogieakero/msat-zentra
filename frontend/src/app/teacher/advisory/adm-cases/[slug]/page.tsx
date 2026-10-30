"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useDock } from "@/components/dock/dock-store";
import { apiErrorMessage } from "@/lib/api/errors";
import { sileo } from "@/components/ui/sonner";
import {
  admMonitoringKey,
  fetchAdmMonitoringCase,
  updateAdmModule,
  type AdmModulePayload,
  type AdmMonitoredModule,
} from "@/services/teacher/admMonitoring.service";
import { MonitoringHeader } from "./components/monitoring-header";
import { MonitoringProgress } from "./components/monitoring-progress";
import { ModulesPanel } from "./components/modules-panel";
import { ModuleFormDialog } from "./components/module-form-dialog";
import { MonitoringReport } from "./components/monitoring-report";

function MonitoringSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading ADM monitoring">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-28 animate-pulse rounded-lg border bg-muted/40" />
      <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />
      <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}

export default function AdmMonitoringPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const caseRef = Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : (rawSlug ?? "");
  const queryClient = useQueryClient();
  const dock = useDock();

  const [dialog, setDialog] = React.useState<AdmMonitoredModule | null>(null);
  // Shared dock task started when the dialog closes; finished by the mutation.
  const dockTaskRef = React.useRef<string | null>(null);

  const monitoringQuery = useQuery({
    queryKey: admMonitoringKey(caseRef),
    queryFn: ({ signal }) => fetchAdmMonitoringCase(caseRef, signal),
    enabled: Boolean(caseRef),
    retry: false,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: admMonitoringKey(caseRef) });
    void queryClient.invalidateQueries({ queryKey: ["adm-my-cases"] });
  }, [caseRef, queryClient]);

  const saveModule = useMutation({
    mutationFn: (vars: { payload: AdmModulePayload; moduleId: string }) =>
      updateAdmModule(caseRef, vars.moduleId, vars.payload),
    onSuccess: (_saved, vars) => {
      const taskId = dockTaskRef.current;
      dockTaskRef.current = null;
      if (taskId) {
        dock.completeTask(taskId, `${vars.payload.moduleName ?? "Module"} updated`);
      }
      invalidate();
      sileo.success({
        title: "Module updated",
        description: "Module tracking and the monitoring report now reflect this change.",
      });
    },
    onError: (err) => {
      const message = apiErrorMessage(err, "Could not save this module.");
      const taskId = dockTaskRef.current;
      dockTaskRef.current = null;
      if (taskId) dock.failTask(taskId, message);
      sileo.error({ title: "Could not save this module", description: message });
    },
  });

  const data = monitoringQuery.data;
  const error = monitoringQuery.error;

  if (!caseRef) {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-sm text-muted-foreground">ADM case not found.</p>
        <Button asChild variant="outline" className="h-7 w-fit px-2.5 text-xs">
          <Link href="/teacher/advisory/adm-cases">Back to ADM cases</Link>
        </Button>
      </div>
    );
  }

  if (monitoringQuery.isPending) return <MonitoringSkeleton />;

  if (error || !data) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-10 text-center">
          <ShieldOff size={28} className="text-muted-foreground" aria-hidden />
          <p role="alert" className="m-0 font-semibold text-foreground">
            {apiErrorMessage(error, "Could not load this ADM case.")}
          </p>
          <p className="m-0 max-w-sm text-xs text-muted-foreground">
            Monitoring is limited to ADM cases of your own advisees.
          </p>
          <Button asChild variant="outline" className="h-7 px-2.5 text-xs">
            <Link href="/teacher/advisory/adm-cases">Back to ADM cases</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { header, progress, modules, devices } = data;

  return (
    <div className="flex w-full flex-col gap-4">
      <MonitoringHeader header={header} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <ModulesPanel
            modules={modules}
            onEdit={(module) => setDialog(module)}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <MonitoringProgress progress={progress} />
          <MonitoringReport data={data} />

          {devices.length > 0 ? (
            <section className="rounded-lg border bg-card p-4" aria-label="Issued devices">
              <h2 className="m-0 mb-2 text-sm font-bold tracking-[-0.01em] text-foreground">
                Devices
              </h2>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-foreground" title={`${d.deviceType} · ${d.deviceSerial}`}>
                      {d.deviceType}
                    </span>
                    <Pill tone={d.returnedDate ? "neutral" : "blue"} label="Device status">
                      {d.returnedDate ? "Returned" : "Issued"}
                    </Pill>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {dialog ? (
        <ModuleFormDialog
          key={dialog.id}
          module={dialog}
          pending={saveModule.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => {
            const moduleId = dialog.id;
            const label = payload.moduleName ?? "Module";
            // Close at once and finish in the shared dock, so the desk never
            // waits on the request with a blocking overlay.
            dockTaskRef.current = dock.startTask({
              kind: "generic",
              title: "Updating module",
              description: label,
            });
            setDialog(null);
            saveModule.mutate({ payload, moduleId });
          }}
        />
      ) : null}

      {saveModule.isPending ? (
        <span className="sr-only" role="status">
          <Loader2 size={12} className="animate-spin" aria-hidden /> Saving module…
        </span>
      ) : null}
    </div>
  );
}
