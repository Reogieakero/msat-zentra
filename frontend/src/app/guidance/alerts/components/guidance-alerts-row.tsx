"use client";
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import { formatActionTime, rowStatusLabel } from "../../referrals/components/guidance-referrals-format";
import {
  GuidanceAlertsRowActions,
  GuidanceInterventionRowActions,
} from "./GuidanceAlertsRowActions";
import { formatElapsedShort, msSinceDate as msSince } from "@/lib/clock";
import { referralStatusVariant, rowLatest, type GuidanceAlertRow } from "./guidance-alerts-helpers";
import styles from "./guidance-alerts-table.module.css";
export function RiskBadge({ level }: { level: GuidanceRiskLevel | undefined }) {
  if (!level) return <span className={styles.noRisk}>—</span>;
  const variant =
    level === "High" ? "red" : level === "Moderate" ? "amber" : "outline";
  return <Badge variant={variant}>{level}</Badge>;
}
export function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("moved")) return <CalendarClock {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward") ||
    text.includes("specialist") ||
    text.includes("adm process") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
}
export function CaseTableRow({
  row,
  riskLevel,
  now,
}: {
  row: GuidanceAlertRow;
  riskLevel: GuidanceRiskLevel | undefined;
  now: number;
}) {
  const latest = rowLatest(row);
  const actionMs = latest.time ? msSince(latest.time, now) : null;
  if (row.kind === "intervention") {
    const item = row.item;
    const iv = item.intervention;
    const detectedRaw = item.detectedAt || iv?.createdAt || "";
    const detectedText = detectedRaw ? formatActionTime(detectedRaw) : "Just now";
    const detectedMs = detectedRaw ? (msSince(detectedRaw, now) ?? 0) : 0;
    const outcome = iv?.outcomeStatus ?? "ongoing";
    const statusVar = !iv
      ? "amber"
      : outcome === "ongoing"
        ? "default"
        : outcome === "resolved"
          ? "success"
          : "destructive";
    const statusText = !iv
      ? "Just detected"
      : outcome === "ongoing"
        ? "Ongoing"
        : outcome === "resolved"
          ? "Resolved"
          : "Unresolved";
    const doneCount = iv?.completedSessions ?? 0;
    return (
      <TableRow>
        <TableCell>
          <p className={styles.studentName}>{item.student}</p>
          <p className={styles.cellSub}>
            <span className={styles.lrn}>{item.lrn}</span> · {item.section}
          </p>
        </TableCell>
        <TableCell>
          <Badge variant="default">Intervention</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={statusVar}>{statusText}</Badge>
          {doneCount > 0 && outcome === "ongoing" ? (
            <p className={styles.cellSub}>
              {doneCount} session{doneCount === 1 ? "" : "s"} done
            </p>
          ) : null}
        </TableCell>
        <TableCell>
          <RiskBadge level={riskLevel} />
        </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
        </TableCell>
        <TableCell>
          <GuidanceInterventionRowActions
            item={item}
            elapsedText={
              detectedMs < 60_000 ? "just now" : `${formatElapsedShort(detectedMs)} ago`
            }
            referredLabel="Date detected"
            referredText={detectedText}
          />
        </TableCell>
      </TableRow>
    );
  }
  const r = row.referral;
  const doneCount = r.sessions.filter((s) => s.status === "completed").length;
  const allDone = doneCount > 0 && !r.sessions.some((s) => s.status === "scheduled");
  const statusText = allDone ? "Done" : rowStatusLabel(r.type, r.status, r);
  const statusVar = allDone ? "success" : referralStatusVariant(r.type, r.status);
  return (
    <TableRow>
      <TableCell>
        <p className={styles.studentName}>{r.student}</p>
        <p className={styles.cellSub}>
          <span className={styles.lrn}>{r.lrn}</span> · {r.section}
        </p>
      </TableCell>
      <TableCell>
        {r.type === "ADM" ? (
          <Badge variant="secondary">ADM</Badge>
        ) : (
          <Badge variant="outline">Counseling</Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={statusVar}>{statusText}</Badge>
        {doneCount > 0 && !allDone ? (
          <p className={styles.cellSub}>
            {doneCount} session{doneCount === 1 ? "" : "s"} done
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <RiskBadge level={riskLevel} />
      </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
        </TableCell>
        <TableCell>
          <GuidanceAlertsRowActions
            row={r}
            elapsedText={actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
            referredText={formatActionTime(r.date)}
          />
        </TableCell>
    </TableRow>
  );
}
