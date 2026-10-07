"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AccountBreakdown.module.css";

const ACTIVE_COLOR = "var(--primary)";
const PENDING_COLOR = "color-mix(in oklch, var(--primary) 55%, var(--card))";

interface BreakdownGroup {
  id: string;
  label: string;
  grade: string;
  withAccount: number;
  pending: number;
}

interface BreakdownResponse {
  data: BreakdownGroup[];
}

function fetchBreakdown() {
  return apiClient
    .get<BreakdownResponse>("/api/registrar/account-breakdown")
    .then((res) => res.data)
    .catch((err) => {
      console.error("[/api/registrar/account-breakdown] fetch failed:", err);
      throw err;
    });
}

interface GaugeSegment {
  name: string;
  value: number;
  count: number;
  fill: string;
}

/* Floating tooltip for the band gauge — plain card styling so it reads like
   the rest of the desk. Rendered inside the chart container, so it carries
   its own high z-index (see .gaugeTip in the module CSS) to float above the
   card glow, legends, and neighboring cards. */
function GaugeTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; payload?: GaugeSegment; color?: string }[];
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.gaugeTip} role="status">
      <p className={styles.gaugeTipTitle}>Band coverage</p>
      <ul className={styles.gaugeTipList}>
        {payload.map((entry, i) => {
          const seg = entry.payload;
          if (!seg) return null;
          const share = total === 0 ? 0 : Math.round((seg.count / total) * 100);
          return (
            <li key={`${seg.name}-${i}`} className={styles.gaugeTipRow}>
              <span
                className={styles.gaugeTipSwatch}
                style={{ backgroundColor: seg.fill }}
                aria-hidden
              />
              <span className={styles.gaugeTipName}>{seg.name}</span>
              <span className={styles.gaugeTipValue}>
                {seg.count} ({share}%)
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.gaugeTipTotal}>
        {total} enrolled this school year
      </p>
    </div>
  );
}

function BandGauge({
  active,
  pending,
  sections,
}: {
  active: number;
  pending: number;
  sections: number;
}) {
  const total = active + pending;
  const activePct = total === 0 ? 0 : Math.round((active / total) * 100);
  const pendingPct = 100 - activePct;

  const series: GaugeSegment[] = [
    { name: "With account", value: activePct, count: active, fill: ACTIVE_COLOR },
    { name: "Pending sign-up", value: pendingPct, count: pending, fill: PENDING_COLOR },
  ];

  if (total === 0) {
    return <p className={styles.empty}>No enrollments on record.</p>;
  }

  return (
    <div className={styles.bandGauge}>
      <div className={styles.gaugeWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="100%"
            barSize={16}
            data={series}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <Tooltip
              content={<GaugeTooltip total={total} />}
              wrapperStyle={{ zIndex: 100 }}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: "color-mix(in oklch, var(--foreground), transparent 92%)" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className={styles.gaugeCenter} aria-hidden>
          <span className={styles.gaugeCenterPct}>{activePct}%</span>
          <span className={styles.gaugeCenterLabel}>with account</span>
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendEntry}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: ACTIVE_COLOR }}
            aria-hidden
          />
          <div className={styles.legendBody}>
            <div className={styles.legendLine}>
              <span className={styles.legendPercent}>{activePct}%</span>
              <span className={styles.legendLabel}> - With account</span>
            </div>
            <p className={styles.legendCount}>
              {active} student{active !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className={styles.legendEntry}>
          <span
            className={styles.legendSwatch}
            style={{ backgroundColor: PENDING_COLOR }}
            aria-hidden
          />
          <div className={styles.legendBody}>
            <div className={styles.legendLine}>
              <span className={styles.legendPercent}>{pendingPct}%</span>
              <span className={styles.legendLabel}> - Pending sign-up</span>
            </div>
            <p className={styles.legendCount}>
              {pending} student{pending !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <p className={styles.legendCount}>
          {sections} section{sections !== 1 ? "s" : ""} · {total} enrolled
        </p>
      </div>
    </div>
  );
}

export function AccountBreakdown() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-account-breakdown"],
    queryFn: fetchBreakdown,
  });

  // The breakdown endpoint has returned non-array payloads in the wild
  // (cached/error shapes) — never let one crash the cards below.
  const groups = React.useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data],
  );

  // One gauge for the whole band scope — section/grade detail already lives
  // on the Accounts page, so the overview shows band totals only.
  const totals = React.useMemo(() => {
    const active = groups.reduce((s, g) => s + g.withAccount, 0);
    const pending = groups.reduce((s, g) => s + g.pending, 0);
    return { active, pending, total: active + pending, sections: groups.length };
  }, [groups]);

  const coverage =
    totals.total === 0 ? 0 : Math.round((totals.active / totals.total) * 100);

  return (
    <section className={assign.card} aria-labelledby="overview-account-coverage">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="overview-account-coverage" className="text-base font-semibold">
            Account Breakdown
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active-year roster vs sign-up status across the whole band.
          </p>
        </div>
        <div className="relative">
          {isPending ? (
            <Badge variant="amber" className={styles.pendingBadge}>
              …
            </Badge>
          ) : (
            <Badge variant="amber" className={styles.pendingBadge}>
              {totals.pending} pending
            </Badge>
          )}
        </div>
      </div>
      <div className={`${styles.content} relative`}>
        {isPending ? (
          <div className={styles.skelWrap}>
            <Skeleton className={styles.skelGrade} />
          </div>
        ) : isError ? (
          <p className={styles.empty}>Could not load the account breakdown.</p>
        ) : (
          <>
            {totals.total === 0 ? (
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <Users />
                </span>
                <p className={styles.emptyTitle}>No roster entries yet</p>
                <p className={styles.emptyHint}>
                  Coverage details appear once the grade band has roster entries
                  this school year.
                </p>
              </div>
            ) : (
              <BandGauge
                active={totals.active}
                pending={totals.pending}
                sections={totals.sections}
              />
            )}

            <p className={styles.footnote}>
              {coverage}% of enrolled students already have an active account. Pending
              counts reconcile with the Pending Approvals list above.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
