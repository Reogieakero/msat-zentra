"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchGuidanceAlerts } from "@/services/guidance/alerts.service";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import type { GuidanceRiskRow } from "./guidance-risk-dashboard";
import styles from "./risk-watch.module.css";

export interface GuidanceRiskFactorFlags {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

const FACTOR_WORDS: Record<keyof GuidanceRiskFactorFlags, string> = {
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};

export interface RiskWatchedStudent {
  studentId: string;
  student: string;
  section: string;
  drivers: string[];
  referralId: string;
  kind: string;
}

export interface RiskWatchData {
  urgent: number;
  watch: number;
  okay: number;
  unknown: number;
  watchlist: RiskWatchedStudent[];
  topDriver: string | null;
  topDriverCount: number;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Per-student factor flags from the flagged-student queue
 * (`GET /api/guidance/alerts`), keyed by normalized student name. The
 * alerts feed is per-student while risk rows are per-referral, so names are
 * the join key — flags OR-merge when a student appears more than once.
 * Students with no alert row simply carry no drivers (never assumed).
 */
export async function fetchAllGuidanceAlertFactors(): Promise<
  Record<string, GuidanceRiskFactorFlags>
> {
  const first = await fetchGuidanceAlerts({ page: 1, pageSize: 100 });
  const pages = Math.min(first.totalPages, 10);
  const all = [...first.alerts];
  for (let p = 2; p <= pages; p++) {
    const res = await fetchGuidanceAlerts({ page: p, pageSize: 100 });
    all.push(...res.alerts);
  }
  const map: Record<string, GuidanceRiskFactorFlags> = {};
  for (const a of all) {
    const key = normalizeName(a.student);
    if (!key) continue;
    const prev = map[key] ?? { academic: false, attendance: false, behavioral: false };
    map[key] = {
      academic: prev.academic || a.factors.academic === true,
      attendance: prev.attendance || a.factors.attendance === true,
      behavioral: prev.behavioral || a.factors.behavioral === true,
    };
  }
  return map;
}

function referredMs(row: GuidanceRiskRow): number {
  const t = new Date(row.referredAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Plain-words risk watch over the guidance desk students — level mix, the
 * High watchlist with driving concerns, and the top flagged concern.
 * Students with no level stay out of the mix (never assumed okay). Links
 * land on each student's newest timeline case. Pure derivation from live
 * rows, so it repaints with the desk.
 */
export function buildGuidanceRiskWatch(
  rows: GuidanceRiskRow[],
  referralToStudent: Record<string, string | null>,
  referralToName: Record<string, string>,
  riskByStudent: Record<string, GuidanceRiskLevel>,
  factorByStudentName: Record<string, GuidanceRiskFactorFlags>
): RiskWatchData {
  const newestByStudent = new Map<string, GuidanceRiskRow>();
  for (const row of rows) {
    const sid = referralToStudent[row.id] ?? null;
    if (!sid) continue;
    const prev = newestByStudent.get(sid);
    if (!prev || referredMs(row) >= referredMs(prev)) newestByStudent.set(sid, row);
  }

  let urgent = 0;
  let watch = 0;
  let okay = 0;
  const driverCounts: { key: keyof GuidanceRiskFactorFlags; count: number }[] = [
    { key: "academic", count: 0 },
    { key: "attendance", count: 0 },
    { key: "behavioral", count: 0 },
  ];
  const watched: RiskWatchedStudent[] = [];
  for (const [studentId, row] of newestByStudent) {
    const level = riskByStudent[studentId];
    if (level === "High") urgent += 1;
    else if (level === "Moderate") watch += 1;
    else if (level === "Low") okay += 1;
    else continue;
    const flags = factorByStudentName[normalizeName(referralToName[row.id] ?? "")];
    const drivers = (Object.keys(FACTOR_WORDS) as (keyof GuidanceRiskFactorFlags)[]).filter(
      (k) => flags?.[k] === true
    );
    for (const d of driverCounts) {
      if (flags?.[d.key] === true) d.count += 1;
    }
    if (level === "High") {
      watched.push({
        studentId,
        student: referralToName[row.id] || "Unknown student",
        section: row.section || "",
        drivers: drivers.map((k) => FACTOR_WORDS[k]),
        referralId: row.id,
        kind: row.track || "",
      });
    }
  }
  watched.sort(
    (a, b) => b.drivers.length - a.drivers.length || a.student.localeCompare(b.student)
  );
  const topDriver = [...driverCounts].sort((a, b) => b.count - a.count)[0];
  return {
    urgent,
    watch,
    okay,
    unknown: newestByStudent.size - urgent - watch - okay,
    watchlist: watched.slice(0, 5),
    topDriver: topDriver && topDriver.count > 0 ? FACTOR_WORDS[topDriver.key] : null,
    topDriverCount: topDriver?.count ?? 0,
  };
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  const [last, ...rest] = parts.slice().reverse();
  return `${rest.reverse().join(", ")} and ${last}`;
}

export function GuidanceRiskWatchCard({ data }: { data: RiskWatchData }) {
  const known = data.urgent + data.watch + data.okay;
  const parts: string[] = [];
  if (data.urgent > 0)
    parts.push(`${data.urgent} need${data.urgent === 1 ? "s" : ""} urgent attention`);
  if (data.watch > 0) parts.push(`${data.watch} to keep an eye on`);
  if (data.okay > 0) parts.push(`${data.okay} doing okay`);
  const hidden = Math.max(0, data.urgent - data.watchlist.length);
  return (
    <Card className={styles.glow} aria-label="Students needing attention">
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <CardTitle className={styles.title}>Who needs attention first</CardTitle>
        <CardDescription className={styles.desc}>
          High-risk students in plain words — names open their timeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {known === 0 ? (
          <p className={styles.message} role="status">
            {data.unknown > 0
              ? `Risk info is missing for ${data.unknown} student${data.unknown === 1 ? "" : "s"} — levels will appear here once the lookup resolves.`
              : "Risk levels will appear here once referred students resolve one."}
          </p>
        ) : (
          <>
            <p className={styles.message} role="status">
              {joinParts(parts)}.
              {data.watchlist.length > 0 && (
                <>
                  {" "}Start with{" "}
                  {data.watchlist.map((s, i) => (
                    <span key={s.studentId}>
                      {i > 0 ? (i === data.watchlist.length - 1 ? " and " : ", ") : ""}
                      <Link
                        className={styles.nameLink}
                        href={`/guidance/referrals/${s.kind === "ADM" ? "adm" : "counseling"}?highlight=${s.referralId}`}
                      >
                        {s.student}
                      </Link>
                    </span>
                  ))}
                  {hidden > 0 ? ` and ${hidden} more` : ""}.
                </>
              )}
            </p>
            {data.topDriver && (
              <p className={styles.message} role="status">
                Most flagged concern: {data.topDriver} ({data.topDriverCount} student
                {data.topDriverCount === 1 ? "" : "s"}).
              </p>
            )}
          </>
        )}
        <p className={styles.interpretation} role="status">
          {known === 0
            ? "Start with the heatmap and levels below until risk levels load."
            : data.urgent > 0
              ? "Open their names first — the flagged concerns tell you what to check."
              : data.watch > 0
                ? "Nobody needs urgent attention right now — keep an eye on the watch group."
                : "Everyone referred is doing okay — hold the line with routine follow-through."}
        </p>
      </CardContent>
    </Card>
  );
}
