"use client";

import * as React from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { AdmMonitoringCase } from "@/services/teacher/admMonitoring.service";

const dateLabel = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function MonitoringReport({ data }: { data: AdmMonitoringCase }) {
  const { header, progress, modules, devices, meetings } = data;
  const [downloading, setDownloading] = React.useState(false);

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
    <section className="flex min-w-0 flex-col gap-3" aria-label="Monitoring report">
      <header className="flex items-center gap-2">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <FileText size={13} aria-hidden />
          <span className="truncate">Monitoring report</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
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
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {progress.submitted}/{progress.total} submitted
          </span>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Learner", value: header.studentName },
          {
            label: "Section · Grade",
            value: `${header.section} · ${header.gradeLevel.replace("G", "Grade ")}`,
          },
          { label: "Monitoring since", value: dateLabel(header.monitoringSince) ?? "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background px-3 py-2 text-center"
          >
            <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p
              className="m-0 w-full truncate text-xs font-bold text-foreground"
              title={value}
            >
              {value}
            </p>
          </div>
        ))}
        <div className="flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background px-3 py-2 text-center">
          <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            LRN
          </p>
          <Pill tone="neutral" label="LRN" className="tabular-nums">
            {header.lrn}
          </Pill>
        </div>
      </div>
    </section>
  );
}
