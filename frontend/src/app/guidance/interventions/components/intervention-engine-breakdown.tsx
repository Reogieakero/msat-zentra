"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchInterventionEngine,
  type EngineBreakdown as EngineBreakdownData,
} from "./guidance-interventions-data";
import rowStyles from "./intervention-row.module.css";

/* Risk-level color code — Low green, Moderate amber, High red — shared by
   the engine strip and every factor badge in the sheet. NOTE: the app
   theme is monochrome (`--destructive` is near-black/white ink), so High
   uses the explicit `red` badge variant — `destructive` would render gray. */
export function levelVariant(level: string): "red" | "amber" | "green" {
  if (level === "High") return "red";
  if (level === "Moderate") return "amber";
  return "green";
}

/* Shared live-engine query — the summary chip and the breakdown read the
   same cached result, so the sheet never disagrees with itself. Lazy:
   only fetched when the details sheet opens. */
export function useInterventionEngine(studentKey: string, enabled = true) {
  return useQuery({
    queryKey: ["guidance-interventions", "engine", studentKey],
    queryFn: ({ signal }) => fetchInterventionEngine(studentKey, { signal }),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

interface EngineBreakdownProps {
  studentKey: string;
  factors: { academic: boolean; attendance: boolean; behavioral: boolean };
  openReferrals: number;
  closedReferrals: number;
  highPriority: boolean;
}

function EngineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading risk breakdown">
      <div className={rowStyles.engineStrip}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={rowStyles.engineStep}>
            <Skeleton style={{ width: "3.5rem", height: "0.7rem" }} />
            <Skeleton style={{ width: "4.5rem", height: "1.25rem" }} />
          </div>
        ))}
      </div>
      <div className={rowStyles.factorGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={rowStyles.factorCard}>
            <Skeleton style={{ width: "60%", height: "0.875rem" }} />
            <Skeleton style={{ width: "100%", height: "0.75rem" }} />
            <Skeleton style={{ width: "80%", height: "0.75rem" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Snapshot fallback — the flagged booleans the table already carries, for
   when the live breakdown can't be reached. The sheet never breaks. */
function SnapshotFallback({
  factors,
  openReferrals,
  closedReferrals,
  highPriority,
}: Omit<EngineBreakdownProps, "studentKey">) {
  return (
    <div>
      <p className={rowStyles.cellSub}>
        Live breakdown unavailable — showing the flagged snapshot instead.
      </p>
      <ul className={rowStyles.factorList}>
        {factors.academic && <li>Low grades</li>}
        {factors.attendance && <li>Absences</li>}
        {factors.behavioral && <li>Behavior report</li>}
      </ul>
      <ReferralContextLine openReferrals={openReferrals} closedReferrals={closedReferrals} highPriority={highPriority} />
    </div>
  );
}

function ReferralContextLine({
  openReferrals,
  closedReferrals,
  highPriority,
}: {
  openReferrals: number;
  closedReferrals: number;
  highPriority: boolean;
}) {
  if (openReferrals <= 0 && closedReferrals <= 0 && !highPriority) return null;
  return (
    <>
      {openReferrals > 0 || closedReferrals > 0 ? (
        <p className={rowStyles.cellSub}>
          Also has adviser-referred cases:{" "}
          {[
            openReferrals > 0 ? `${openReferrals} open` : "",
            closedReferrals > 0 ? `${closedReferrals} resolved` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {highPriority ? <p className={rowStyles.cellSub}>High priority</p> : null}
    </>
  );
}

function EngineStrip({ data }: { data: EngineBreakdownData }) {
  const steps: { label: string; level: string }[] = [
    {
      label: "Flagged",
      level: data.flagged?.level ?? "—",
    },
    {
      label: "Stored now",
      level: data.stored?.level ?? "—",
    },
    {
      label: "Live engine",
      level: data.live.level,
    },
  ];
  return (
    <div className={rowStyles.engineStrip} aria-label="Risk level trail">
      {steps.map((s, i) => (
        <div key={s.label} className={rowStyles.engineStep}>
          <span className={rowStyles.engineStepLabel}>
            {s.label}
            {i < steps.length - 1 ? <span aria-hidden="true"> → </span> : null}
          </span>
          <Badge variant={levelVariant(s.level)}>{s.level}</Badge>
        </div>
      ))}
    </div>
  );
}

function DivergenceNote({ data }: { data: EngineBreakdownData }) {
  const storedLevel = data.stored?.level;
  if (!storedLevel || storedLevel === data.live.level) return null;
  if (data.live.level === "Low") {
    return (
      <p className={rowStyles.cellSub}>
        Risk cleared since detection (was {storedLevel}) — the case can be discontinued once the
        follow-up closes out.
      </p>
    );
  }
  return (
    <p className={rowStyles.cellSub}>
      Engine now says {data.live.level} (stored snapshot says {storedLevel}).
    </p>
  );
}

/**
 * Pro-level risk breakdown for See details — live engine values (subject
 * grades, attendance rate, behavior filings) plus the flagged → stored →
 * live level trail, mirroring the principal InterventionDrawer pattern.
 * Lazy: mounted only when the details sheet opens.
 */
export function EngineBreakdown({
  studentKey,
  factors,
  openReferrals,
  closedReferrals,
  highPriority,
}: EngineBreakdownProps) {
  const breakdown = useInterventionEngine(studentKey);

  if (breakdown.isPending) return <EngineSkeleton />;
  const data = breakdown.data;
  if (breakdown.isError || !data) {
    return (
      <SnapshotFallback
        factors={factors}
        openReferrals={openReferrals}
        closedReferrals={closedReferrals}
        highPriority={highPriority}
      />
    );
  }

  const academicOn = data.live.academic;
  const attendanceOn = data.live.attendance;
  const behavioralOn = data.live.behavioral;

  /* Hero number color: flagged factors take the live risk color
     (High red, Moderate amber); Clear factors stay gray. Red is explicit
     (theme destructive is monochrome ink). */
  const heroClass = (on: boolean): string =>
    !on
      ? "text-muted-foreground"
      : data.live.level === "High"
        ? "text-red-700 dark:text-red-400"
        : "text-amber-700 dark:text-amber-400";

  return (
    <div className={rowStyles.engineWrap}>
      <EngineStrip data={data} />
      <DivergenceNote data={data} />
      <div className={rowStyles.factorGrid}>
        <div className={rowStyles.factorCard}>
          <span className={rowStyles.glowClip} aria-hidden="true">
            <span className={rowStyles.cardGlow} />
          </span>
          <div className={rowStyles.factorInner}>
          <div className={rowStyles.factorHead}>
            <span className={rowStyles.factorTitle}>Academic</span>
            <Badge variant={levelVariant(academicOn ? data.live.level : "Low")}>
              {academicOn ? data.live.level : "Low"}
            </Badge>
          </div>
          <p className={`${rowStyles.heroValue} ${heroClass(academicOn)}`} aria-label={data.academic.average === null ? "No academic average" : `Academic average ${data.academic.average.toFixed(1)} percent`}>
            {data.academic.average === null ? "—" : `${data.academic.average.toFixed(1)}%`}
          </p>
          <p className={rowStyles.cellSub}>
            {data.academic.average === null
              ? "No final grades on record this term."
              : `Average ${data.academic.average.toFixed(1)}% (raw percentage).`}
          </p>
          <p className={rowStyles.cellSub}>
            {data.academic.transmutedAverage === null
              ? "No transmuted grades yet — flag follows transmuted grades."
              : `Transmuted avg ${data.academic.transmutedAverage.toFixed(0)} — ${data.academic.transmutedAverage < data.academic.threshold ? `below the ${data.academic.threshold} line` : `above the ${data.academic.threshold} line`}.`}
          </p>
          </div>
        </div>
        <div className={rowStyles.factorCard}>
          <span className={rowStyles.glowClip} aria-hidden="true">
            <span className={rowStyles.cardGlow} />
          </span>
          <div className={rowStyles.factorInner}>
          <div className={rowStyles.factorHead}>
            <span className={rowStyles.factorTitle}>Attendance</span>
            <Badge variant={levelVariant(attendanceOn ? data.live.level : "Low")}>
              {attendanceOn ? data.live.level : "Low"}
            </Badge>
          </div>
          <p className={`${rowStyles.heroValue} ${heroClass(attendanceOn)}`} aria-label={data.attendance.rate === null ? "No attendance average" : `Attendance ${Math.round(data.attendance.rate * 100)} percent present`}>
            {data.attendance.rate === null ? "—" : `${Math.round(data.attendance.rate * 100)}%`}
          </p>
          <p className={rowStyles.cellSub}>
            {data.attendance.rate === null
              ? "No attendance records this term."
              : "Present."}
          </p>
          </div>
        </div>
        <div className={rowStyles.factorCard}>
          <span className={rowStyles.glowClip} aria-hidden="true">
            <span className={rowStyles.cardGlow} />
          </span>
          <div className={rowStyles.factorInner}>
          <div className={rowStyles.factorHead}>
            <span className={rowStyles.factorTitle}>Anecdotal</span>
            <Badge variant={levelVariant(behavioralOn ? data.live.level : "Low")}>
              {behavioralOn ? data.live.level : "Low"}
            </Badge>
          </div>
          <p className={`${rowStyles.heroValue} ${heroClass(behavioralOn)}`} aria-label={`${data.behavioral.count} anecdotal reports`}>
            {data.behavioral.count}
          </p>
          <p className={rowStyles.cellSub}>
            {data.behavioral.count === 0
              ? "No anecdotal filings this term."
              : `Anecdotal report${data.behavioral.count === 1 ? "" : "s"} on record this term.`}
          </p>
          </div>
        </div>
      </div>
      <ReferralContextLine openReferrals={openReferrals} closedReferrals={closedReferrals} highPriority={highPriority} />
    </div>
  );
}
