"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { RISK_FACTOR_WORDS } from "@/services/nurse/risk.service";
import type {
  NurseRiskFactors,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import styles from "./risk-watch.module.css";

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

function referredMs(row: NurseQueueRow): number {
  const t = new Date(row.referredAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function buildRiskWatch(
  rows: NurseQueueRow[],
  referralToStudent: Record<string, string>,
  riskByStudent: Record<string, NurseRiskLevel>,
  riskFactors: Record<string, NurseRiskFactors>,
): RiskWatchData {
  const newestByStudent = new Map<string, NurseQueueRow>();
  for (const row of rows) {
    const sid = referralToStudent[row.id] ?? null;
    if (!sid) continue;
    const prev = newestByStudent.get(sid);
    if (!prev || referredMs(row) >= referredMs(prev)) newestByStudent.set(sid, row);
  }

  let urgent = 0;
  let watch = 0;
  let okay = 0;
  const driverCounts: { key: keyof NurseRiskFactors; count: number }[] = [
    { key: "Academic", count: 0 },
    { key: "Attendance", count: 0 },
    { key: "Behavioral", count: 0 },
  ];
  const watched: RiskWatchedStudent[] = [];
  for (const [studentId, row] of newestByStudent) {
    const level = riskByStudent[studentId];
    if (level === "High") urgent += 1;
    else if (level === "Moderate") watch += 1;
    else if (level === "Low") okay += 1;
    else continue;
    const flags = riskFactors[studentId];
    const drivers = (
      Object.keys(RISK_FACTOR_WORDS) as (keyof NurseRiskFactors)[]
    ).filter((k) => flags?.[k] === true);
    for (const d of driverCounts) {
      if (flags?.[d.key] === true) d.count += 1;
    }
    if (level === "High") {
      watched.push({
        studentId,
        student: row.student || "Unknown student",
        section: row.section || "",
        drivers: drivers.map((k) => RISK_FACTOR_WORDS[k]),
        referralId: row.id,
        kind: row.type || "",
      });
    }
  }
  watched.sort(
    (a, b) => b.drivers.length - a.drivers.length || a.student.localeCompare(b.student),
  );
  const topDriver = [...driverCounts].sort((a, b) => b.count - a.count)[0];
  return {
    urgent,
    watch,
    okay,
    unknown: newestByStudent.size - urgent - watch - okay,
    watchlist: watched.slice(0, 5),
    topDriver: topDriver && topDriver.count > 0 ? RISK_FACTOR_WORDS[topDriver.key] : null,
    topDriverCount: topDriver?.count ?? 0,
  };
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  const [last, ...rest] = parts.slice().reverse();
  return `${rest.reverse().join(", ")} and ${last}`;
}

export function RiskWatchCard({ data }: { data: RiskWatchData }) {
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
                        href={`/nurse/referrals/${s.kind === "ADM" ? "adm" : "clinic"}?highlight=${s.referralId}`}
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
