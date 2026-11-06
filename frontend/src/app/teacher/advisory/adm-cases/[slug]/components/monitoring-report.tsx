"use client";

import * as React from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import type { AdmMonitoringCase } from "@/services/teacher/admMonitoring.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const STATUS_FILL: Record<string, string> = {
  submitted: "#16a34a",
  pending: "#f59e0b",
  overdue: "#dc2626",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  pending: "Pending",
  overdue: "Overdue",
};

/** Slice order is fixed so the donut keeps the same colour for the same status. */
const STATUS_ORDER = ["submitted", "pending", "overdue"] as const;

interface StatusSlice {
  key: string;
  label: string;
  value: number;
  percent: number;
  fill: string;
}

/** Same tooltip shell as the teacher reports donut (reports-activity.tsx). */
function ModuleStatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: StatusSlice }[];
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="grid gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 font-sans text-xs shadow-xl">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: slice.fill }}
        />
        {slice.label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Modules</span>
        <span className="font-sans font-medium tabular-nums text-foreground">
          {slice.value} ({slice.percent}%)
        </span>
      </div>
    </div>
  );
}

export function MonitoringReport({ data }: { data: AdmMonitoringCase }) {
  const { header, progress, modules, devices, meetings } = data;
  const [downloading, setDownloading] = React.useState(false);

  // Status split drives the donut + proportion bar. Zero-count statuses stay
  // out of the pie so the ring never renders invisible slices.
  const statusCounts = STATUS_ORDER.map((key) => ({
    key,
    label: STATUS_LABEL[key]!,
    value: modules.filter((m) => m.status === key).length,
    fill: STATUS_FILL[key]!,
  }));
  const countedTotal = statusCounts.reduce((sum, s) => sum + s.value, 0);
  const share = (value: number) =>
    countedTotal > 0 ? Math.round((value / countedTotal) * 100) : 0;
  const slices: StatusSlice[] = statusCounts
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, percent: share(s.value) }));

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 14;
      const tableW = pageW - M * 2;
      const HEAD_H = 8;
      const ROW_H = 7;
      const COLS = [
        { label: "Module", w: 72 },
        { label: "Released", w: 24 },
        { label: "Due", w: 24 },
        { label: "Status", w: 22 },
        { label: "Submitted", w: 28 },
      ];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(17, 24, 39);
      doc.text("ADM Monitoring Report", M, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text("Mati School of Arts and Trades · Flexible Learning (ADM)", M, 26);
      doc.text(`Generated ${new Date().toLocaleString()}`, pageW - M, 26, { align: "right" });

      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text(header.studentName, M, 36);
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text(
        `LRN ${header.lrn}  ·  ${header.gradeLevel.replace("G", "Grade ")} · ${header.section}`,
        M,
        41,
      );
      doc.text(
        `${header.stageLabel} · Eligibility: ${header.eligibilityStatus} · Monitoring since ${dateLabel(header.monitoringSince)}`,
        M,
        46,
      );
      doc.text(
        `Modules submitted: ${progress.submitted}/${progress.total} (${progress.percent}%)  ·  Overdue: ${progress.overdueCount}`,
        M,
        51,
      );

      let y = 58;
      doc.setFillColor(30, 41, 59);
      doc.rect(M, y, tableW, HEAD_H, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      let x = M;
      for (const col of COLS) {
        doc.text(col.label, x + 2, y + 5.2);
        x += col.w;
      }
      y += HEAD_H;
      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "normal");

      const drawHead = () => {
        doc.setFillColor(30, 41, 59);
        doc.rect(M, y, tableW, HEAD_H, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        let hx = M;
        for (const col of COLS) {
          doc.text(col.label, hx + 2, y + 5.2);
          hx += col.w;
        }
        y += HEAD_H;
        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "normal");
      };

      if (modules.length === 0) {
        doc.setFontSize(9);
        doc.text("No modules released yet.", M + 2, y + 5);
        y += ROW_H;
      }

      modules.forEach((m, index) => {
        if (y + ROW_H > pageH - 30) {
          doc.addPage();
          y = 20;
          drawHead();
        }
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(M, y, tableW, ROW_H, "F");
        }
        const cells = [
          m.moduleName,
          dateLabel(m.releaseDate),
          dateLabel(m.dueDate),
          m.status === "submitted" ? "Submitted" : m.status.charAt(0).toUpperCase() + m.status.slice(1),
          m.submitted ? dateLabel(m.submissionDate) : "—",
        ];
        let cx = M;
        doc.setFontSize(8.5);
        cells.forEach((cell, i) => {
          const text = doc.splitTextToSize(String(cell), COLS[i].w - 4)[0] ?? "";
          doc.text(text, cx + 2, y + 4.8);
          cx += COLS[i].w;
        });
        y += ROW_H;
      });

      // Upload links (long URLs don't fit a table cell).
      const linked = modules.filter((m) => m.submissionUrl);
      if (linked.length > 0) {
        y += 6;
        if (y > pageH - 40) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Upload links", M, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        for (const m of linked) {
          if (y > pageH - 25) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${m.moduleName}:`, M, y);
          y += 4;
          const lines = doc.splitTextToSize(m.submissionUrl ?? "", tableW - 4) as string[];
          for (const line of lines) {
            if (y > pageH - 25) {
              doc.addPage();
              y = 20;
            }
            doc.setTextColor(37, 99, 235);
            doc.text(line, M + 3, y);
            doc.setTextColor(17, 24, 39);
            y += 4;
          }
          y += 1;
        }
      }

      // Support summary.
      y += 4;
      if (y > pageH - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Support summary", M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      y += 5;
      doc.text(`Devices issued: ${devices.length}`, M, y);
      doc.text(
        `Parent meetings: ${meetings.length} (${meetings.filter((m) => m.attended).length} attended)`,
        M + 60,
        y,
      );
      y += 12;

      if (y > pageH - 30) {
        doc.addPage();
        y = 20;
      }
      doc.text("_____________________________", M, y);
      doc.text("Adviser signature", M, y + 4);
      doc.text(dateLabel(new Date().toISOString()) ?? "", M + 70, y + 4);

      const safeName = header.studentName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
      doc.save(`ADM-monitoring-${safeName || header.lrn}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <KanbanBoard
      title="Monitoring report"
      icon={<FileText size={13} aria-hidden />}
      count={`${progress.submitted}/${progress.total} submitted`}
      actions={
        <Button
          type="button"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          onClick={() => void handleDownload()}
          disabled={downloading}
          aria-busy={downloading || undefined}
        >
          {downloading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Download size={12} aria-hidden />
          )}
          Download PDF
        </Button>
      }
      className="bg-card"
      ariaLabel="Monitoring report"
    >
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Learner", value: header.studentName, mono: false },
          { label: "LRN", value: header.lrn, mono: true },
          {
            label: "Section · Grade",
            value: `${header.section} · ${header.gradeLevel.replace("G", "Grade ")}`,
            mono: false,
          },
          { label: "Monitoring since", value: dateLabel(header.monitoringSince) ?? "—", mono: false },
        ].map(({ label, value, mono }) => (
          <div key={label} className="min-w-0 rounded-md border bg-background px-3 py-2">
            <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p
              className={
                mono
                  ? "m-0 truncate text-xs font-bold tabular-nums text-foreground"
                  : "m-0 truncate text-xs font-bold text-foreground"
              }
              title={value}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Module status
          </p>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {progress.percent}% complete
          </span>
        </div>

        {countedTotal === 0 ? (
          <p className="m-0 rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No modules released yet.
          </p>
        ) : (
          <div className="flex min-w-0 flex-col gap-2 rounded-md border bg-background p-3">
            <div className="relative mx-auto h-[148px] w-full max-w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="64%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    content={<ModuleStatusTooltip />}
                    wrapperStyle={{ outline: "none", zIndex: 80 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold leading-none tabular-nums text-foreground">
                  {progress.percent}%
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  complete
                </span>
              </div>
            </div>

            {/* Proportion bar + legend: the count lives beside its colour. */}
            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Submitted ${statusCounts[0]!.value}, pending ${statusCounts[1]!.value}, overdue ${statusCounts[2]!.value}`}
            >
              {slices.map((s) => (
                <span
                  key={s.key}
                  className="h-full"
                  style={{ width: `${(s.value / countedTotal) * 100}%`, backgroundColor: s.fill }}
                />
              ))}
            </div>

            <ul className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0">
              {statusCounts.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.fill }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
                  <span className="text-muted-foreground/70 tabular-nums">{share(s.value)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
        <Pill tone="neutral" label="Devices issued">
          Devices {devices.length}
        </Pill>
        <Pill tone="neutral" label="Parent meetings held">
          Meetings {meetings.filter((m) => m.attended).length}/{meetings.length}
        </Pill>
      </div>
    </KanbanBoard>
  );
}
