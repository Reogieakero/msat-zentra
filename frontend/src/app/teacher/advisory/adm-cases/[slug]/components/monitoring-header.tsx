"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ShieldCheck } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import {
  admStageTone,
  eligibilityLabel,
  eligibilityTone,
} from "@/lib/labels/status-tone";
import { StudentMascot } from "../../../referrals/components/StudentMascot";
import type { AdmMonitoringCase } from "@/services/teacher/admMonitoring.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function MonitoringHeader({
  header,
}: {
  header: AdmMonitoringCase["header"];
}) {
  // One board per stat — the identity card above only carries the learner.
  const stats: {
    label: string;
    value: ReactNode;
    icon?: ElementType;
    mono?: boolean;
  }[] = [
    { label: "Section", value: header.section },
    { label: "Grade level", value: header.gradeLevel.replace("G", "Grade ") },
    {
      label: "ADM stage",
      value: (
        <Pill tone={admStageTone(header.stage)} label="ADM stage">
          {header.stageLabel}
        </Pill>
      ),
    },
    {
      label: "Eligibility",
      value: (
        <Pill tone={eligibilityTone(header.eligibilityStatus)} label="Eligibility">
          {eligibilityLabel(header.eligibilityStatus)}
        </Pill>
      ),
    },
    {
      label: "Principal approved",
      value: dateLabel(header.approvedAt) ?? "—",
      icon: ShieldCheck,
    },
    {
      label: "Monitoring since",
      value: dateLabel(header.monitoringSince) ?? "—",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/teacher/advisory/adm-cases"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden /> Back to ADM cases
      </Link>

      <div className="flex flex-wrap items-stretch gap-2" aria-label="Case statistics">
        <div className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2">
          <StudentMascot
            name={header.studentName}
            seed={header.lrn}
            character={header.mascot ?? undefined}
            size={36}
          />
          <div className="flex min-w-0 flex-col justify-between gap-1">
            <p className="m-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Learner
            </p>
            <p
              className="m-0 truncate text-sm font-bold text-foreground"
              title={header.studentName}
            >
              {header.studentName}
            </p>
            <p className="m-0 truncate text-[11px] tabular-nums text-muted-foreground" title="LRN">
              LRN {header.lrn}
            </p>
          </div>
        </div>

        {stats.map(({ label, value, icon: Icon, mono }) => (
          <div
            key={label}
            className="flex min-w-[7.5rem] flex-1 flex-col justify-between gap-1 rounded-md border bg-card px-3 py-2"
          >
            <p className="m-0 flex min-w-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {Icon ? <Icon size={11} className="shrink-0" aria-hidden /> : null}
              <span className="truncate" title={label}>
                {label}
              </span>
            </p>
            <div
              className={
                mono
                  ? "truncate text-sm font-bold tabular-nums text-foreground"
                  : "truncate text-sm font-bold text-foreground"
              }
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
