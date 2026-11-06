"use client";

import { Activity, CalendarClock, Hourglass, Send, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { useTerm } from "@/lib/term/TermContext";
import styles from "../../../guidance/adm/components/guidance-adm.module.css";

const FINDING_META: Record<string, { icon: LucideIcon; accent: string }> = {
  total: { icon: Activity, accent: "text-primary" },
  pending: { icon: Hourglass, accent: "text-amber-500" },
  signed: { icon: Send, accent: "text-blue-500" },
  active: { icon: CalendarClock, accent: "text-orange-500" },
};

export function AdmStats() {
  const { termReady } = useTerm();
  const { data, isPending } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });

  const findings = [
    {
      key: "total",
      label: "Total referred",
      value: String(data?.totalReferred ?? 0),
      hint: "All ADM learners on file school-wide.",
    },
    {
      key: "pending",
      label: "Awaiting your signature",
      value: String(data?.kpis.pendingSignature ?? 0),
      hint: "Certifications waiting at the principal desk.",
    },
    {
      key: "signed",
      label: "Signed this term",
      value: String(data?.kpis.signed ?? 0),
      hint: "Profiles you have approved and released.",
    },
    {
      key: "active",
      label: "Active cases",
      value: String(data?.kpis.active ?? 0),
      hint: "Learners still progressing through ADM.",
    },
  ];

  if (isPending) {
    return (
      <div className={styles.findings} aria-busy="true" aria-label="Loading ADM findings">
        {findings.map((f) => (
          <KanbanBoard key={f.key} title={f.label}>
            <Skeleton className="h-10 w-20" />
          </KanbanBoard>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.findings} role="status" aria-label="Key findings">
      {findings.map((f) => {
        const meta = FINDING_META[f.key] ?? FINDING_META.total;
        const Icon = meta.icon;
        return (
          <KanbanBoard
            key={f.key}
            title={f.label}
            icon={
              <span className={meta.accent} aria-hidden>
                <Icon size={14} />
              </span>
            }
            className="flex-1"
          >
            <p className={styles.findingValue}>{f.value}</p>
            <Pill tone="amber" className="max-w-full self-start truncate">
              {f.hint}
            </Pill>
          </KanbanBoard>
        );
      })}
    </div>
  );
}
