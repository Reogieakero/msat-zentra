"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Flame, Radar } from "lucide-react";
import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "@/services/guidance/guidance.types";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./guidance-alerts-siderail.module.css";

function trackHref(r: GuidanceReferralItem): string {
  const track = r.type === "ADM" ? "adm" : "counseling";
  return `/guidance/referrals/${track}?highlight=${r.id}`;
}

function riskBadgeVariant(level: string): "red" | "amber" | "outline" {
  if (level === "High") return "red";
  if (level === "Moderate") return "amber";
  return "outline";
}

function detectionMs(detectedAt: string | null): number | null {
  if (!detectedAt) return null;
  const t = new Date(detectedAt).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}h ago`;
  return `${totalMinutes}m ago`;
}

function LatestDetectedCard({ interventions }: { interventions: AtRiskStudentItem[] }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const rows = React.useMemo(
    () =>
      [...interventions]
        .sort((a, b) => (detectionMs(b.detectedAt) ?? -1) - (detectionMs(a.detectedAt) ?? -1))
        .slice(0, 1),
    [interventions],
  );

  return (
    <div className={assign.card} aria-label="Latest detected students">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Radar size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Latest detected</h3>
          <p className="text-xs text-muted-foreground">
            Newest engine-flagged students for intervention.
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="relative text-sm text-muted-foreground">
          No students detected yet.
        </p>
      ) : (
        <ol className={`relative flex flex-col gap-2 ${styles.rowList}`}>
          {rows.map((s) => {
            const at = detectionMs(s.detectedAt);
            return (
              <li key={s.studentKey}>
                <Link className={styles.rowLink} href={`/guidance/interventions?highlight=${encodeURIComponent(s.studentKey)}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.student}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {at === null ? "Detection time unknown" : `Detected ${formatElapsed(now - at)}`}
                    </span>
                  </span>
                  <Badge variant={riskBadgeVariant(s.riskLevel)}>{s.riskLevel}</Badge>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function RiskWatchCard({
  referrals,
  interventions,
  riskByStudent,
}: {
  referrals: GuidanceReferralItem[];
  interventions: AtRiskStudentItem[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
}) {
  const { urgent, names } = React.useMemo(() => {
    const seen = new Map<string, { name: string; href: string }>();
    for (const r of referrals) {
      if (!r.studentId || riskByStudent[r.studentId] !== "High") continue;
      const key = `${r.student.trim().toLowerCase()}|${r.lrn.trim().toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { name: r.student, href: trackHref(r) });
    }
    for (const item of interventions) {
      if (item.riskLevel !== "High") continue;
      const key = `${item.student.trim().toLowerCase()}|${item.lrn.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, { name: item.student, href: `/guidance/interventions?highlight=${encodeURIComponent(item.studentKey)}` });
      }
    }
    const list = [...seen.values()].slice(0, 5);
    return { urgent: seen.size, names: list };
  }, [referrals, interventions, riskByStudent]);

  return (
    <div className={assign.card} aria-label="Students needing urgent attention">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Flame size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Risk watch</h3>
          <p className="text-xs text-muted-foreground">High-risk students, in plain words.</p>
        </div>
      </div>
      {urgent === 0 ? (
        <p className="relative text-sm text-muted-foreground">
          Nobody needs urgent attention right now.
        </p>
      ) : (
        <p className={`relative text-sm ${styles.message}`} role="status">
          {urgent} need{urgent === 1 ? "s" : ""} urgent attention. Start with{" "}
          {names.map((s, i) => (
            <span key={s.name}>
              {i > 0 ? (i === names.length - 1 ? " and " : ", ") : ""}
              <Link className={styles.nameLink} href={s.href}>
                {s.name}
              </Link>
            </span>
          ))}
          {urgent > names.length ? ` and ${urgent - names.length} more` : ""}.
        </p>
      )}
    </div>
  );
}

function CaseMixCard({
  referrals,
  interventions,
}: {
  referrals: GuidanceReferralItem[];
  interventions: AtRiskStudentItem[];
}) {
  const adm = referrals.filter((r) => r.type === "ADM").length;
  const counseling = referrals.length - adm;
  const total = referrals.length + interventions.length;
  const top: { label: string; count: number } | null =
    total === 0
      ? null
      : [
          { label: "Counseling", count: counseling },
          { label: "ADM", count: adm },
          { label: "Intervention", count: interventions.length },
        ].sort((a, b) => b.count - a.count)[0];
  return (
    <div className={assign.card} aria-label="Case mix">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <ClipboardList size={20} className="text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Case mix</h3>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "No cases on the desk."
              : `${counseling} counseling · ${adm} ADM · ${interventions.length} intervention`}
          </p>
        </div>
      </div>
      <p className={`relative text-sm ${styles.message}`} role="status">
        {top === null
          ? "New cases will break down here by track."
          : total === top.count
            ? `Everything on the desk is ${top.label.toLowerCase()} (${top.count}).`
            : `Most of the desk is ${top.label.toLowerCase()} (${top.count} of ${total}) — staff follow-through toward it first.`}
      </p>
    </div>
  );
}

export function GuidanceAlertsSideRail({
  referrals,
  interventions,
  riskByStudent,
}: {
  referrals: GuidanceReferralItem[];
  interventions: AtRiskStudentItem[];
  riskByStudent: Record<string, GuidanceRiskLevel>;
}) {
  return (
    <>
      <LatestDetectedCard interventions={interventions} />
      <RiskWatchCard
        referrals={referrals}
        interventions={interventions}
        riskByStudent={riskByStudent}
      />
      <CaseMixCard referrals={referrals} interventions={interventions} />
    </>
  );
}
