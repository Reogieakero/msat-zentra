"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  PieChart,
  TabletSmartphone,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import {
  formatManilaDateLong,
  formatManilaTime,
} from "@/services/coordinator/labels";
import {
  BookedMeetingInfoContent,
  type BookedMeetingInfo,
} from "@/components/session-booking/BookedMeetingInfoPanel";
import { NurseChartTooltip, NURSE_TOOLTIP_Z_INDEX } from "../../../nurse/overview/components/nurse-chart-tooltip";
import type {
  AdmCaseRow,
  AdmDeviceRow,
} from "@/services/coordinator/coordinator.types";
import { AMBER_RAMP, type StageDonutEntry } from "./coordinator-overview-helpers";
import styles from "./coordinator-overview-boards.module.css";

interface CoordinatorOverviewBoardsProps {
  stageDonut: StageDonutEntry[];
  devicesIssued: number | null;
  devicesReturned: number | null;
  devicesPending: boolean;
  oldestOut: AdmDeviceRow[];
  bookedMeetings: AdmCaseRow[];
  bookedPending: boolean;
  now: number;
}

function rowMeetingInfo(r: AdmCaseRow): BookedMeetingInfo | null {
  const m = r.meeting;
  if (!m) return null;
  return {
    studentName: r.student,
    lrn: r.lrn,
    grade: r.grade,
    datetime: m.datetime,
    venue: m.venue,
    attended: m.attended,
    inviteeCount: m.inviteeIds?.length ?? 0,
  };
}

/** Uniform "What it means" footer — the shared insight callout, pinned low. */
function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.footerSlot}>
      <InsightCallout className={styles.interpretation}>
        <span className={styles.interpretationLabel}>What it means · </span>
        {children}
      </InsightCallout>
    </div>
  );
}

/**
 * Pipeline distribution as an amber donut — stages with a non-zero count,
 * each slice a step of the amber ramp, the total in the ring and a compact
 * legend beside it. Tooltip is the same one the nurse overview charts use.
 */
function StageDonutChart({ rows }: { rows: StageDonutEntry[] }) {
  const data = rows.filter((r) => r.value > 0);
  if (data.length === 0) {
    return (
      <p className="flex-1 px-1 py-2 text-xs text-muted-foreground">
        No cases in the pipeline yet.
      </p>
    );
  }
  const total = data.reduce((n, r) => n + r.value, 0);
  const label = data.map((d) => `${d.full} ${d.value}`).join(", ");
  return (
    <div
      className={styles.donutRow}
      role="img"
      aria-label={`Cases by stage: ${label}`}
    >
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={116}>
          <RechartsPieChart>
            <RechartsTooltip
              cursor={false}
              wrapperStyle={NURSE_TOOLTIP_Z_INDEX}
              animationDuration={150}
              animationEasing="ease-out"
              content={
                <NurseChartTooltip
                  formatValue={(item) => {
                    const count = Number(item.value);
                    const pct =
                      total > 0 ? Math.round((count / total) * 100) : 0;
                    return `${item.value} (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="full"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive
              animationDuration={700}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={AMBER_RAMP[i % AMBER_RAMP.length]} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter} aria-hidden="true">
          <span className={styles.donutTotal}>{total}</span>
          <span className={styles.donutLabel}>cases</span>
        </div>
      </div>
      <ul className={styles.donutLegend}>
        {data.map((d, i) => (
          <li key={d.name} className={styles.donutLegendItem}>
            <span
              className={styles.donutSwatch}
              style={{ background: AMBER_RAMP[i % AMBER_RAMP.length] }}
              aria-hidden="true"
            />
            <span className={styles.donutLegendName} title={d.full}>
              {d.full}
            </span>
            <span className={styles.donutLegendValue}>{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Three-board section under the KPI strip — pipeline stages, learning devices
 * and booked parent meetings. Same board chrome as the rest of the desk, with
 * a "What it means" callout pinned to each board's bottom.
 */
export function CoordinatorOverviewBoards({
  stageDonut,
  devicesIssued,
  devicesReturned,
  devicesPending,
  oldestOut,
  bookedMeetings,
  bookedPending,
  now,
}: CoordinatorOverviewBoardsProps) {
  const [infoRow, setInfoRow] = React.useState<AdmCaseRow | null>(null);

  const meetingInfo = React.useMemo<BookedMeetingInfo | null>(
    () => (infoRow ? rowMeetingInfo(infoRow) : null),
    [infoRow],
  );

  const stageTotal = stageDonut.reduce((n, s) => n + s.value, 0);
  const topStage = [...stageDonut].sort((a, b) => b.value - a.value)[0];

  const oldestDevice = oldestOut[0];
  const oldestOutMs = oldestDevice
    ? msSinceDate(oldestDevice.issuedDate, now)
    : null;

  const firstMeeting = bookedMeetings.find((r) => r.meeting)?.meeting;

  return (
    <div className={styles.boardGrid}>
      <KanbanBoard
        title="Cases by stage"
        icon={
          <span className="text-amber-500" aria-hidden>
            <PieChart size={14} />
          </span>
        }
        actions={
          <Button asChild size="sm" className="h-6 px-2 text-xs">
            <Link href="/coordinator/referrals">Open referrals</Link>
          </Button>
        }
        description="Every case in the pipeline, split by the stage it sits in."
        className="flex-1"
        footer={
          <Interpretation>
            {stageTotal === 0
              ? "No cases are in the pipeline yet — new referrals will appear here by stage."
              : topStage
                ? `${stageTotal} case${
                    stageTotal === 1 ? "" : "s"
                  } in the pipeline — most sit at ${topStage.full} (${topStage.value}).`
                : `${stageTotal} case${stageTotal === 1 ? "" : "s"} in the pipeline.`}
          </Interpretation>
        }
      >
        {stageDonut.length === 0 ? (
          <p className="flex-1 px-1 text-xs text-muted-foreground">
            No cases in the pipeline yet — new referrals appear here by stage.
          </p>
        ) : (
          <StageDonutChart rows={stageDonut} />
        )}
      </KanbanBoard>

      <KanbanBoard
        title="Learning devices"
        icon={
          <span className="text-amber-500" aria-hidden>
            <TabletSmartphone size={14} />
          </span>
        }
        actions={
          <Button asChild size="sm" className="h-6 px-2 text-xs">
            <Link href="/coordinator/devices">Open devices</Link>
          </Button>
        }
        description={
          devicesIssued !== null && devicesIssued > 0
            ? `${devicesIssued} still out · ${devicesReturned ?? 0} returned.`
            : undefined
        }
        className="flex-1"
        footer={
          devicesPending ? (
            <Interpretation>Device counts are still loading.</Interpretation>
          ) : devicesIssued === null ? (
            <Interpretation>Device counts are unavailable right now.</Interpretation>
          ) : devicesIssued === 0 ? (
            <Interpretation>
              No tablets are out with a learner right now.
            </Interpretation>
          ) : (
            <Interpretation>
              {devicesIssued} tablet{devicesIssued === 1 ? "" : "s"} still out
              {oldestOutMs !== null
                ? ` — the oldest has been out ${formatElapsedShort(oldestOutMs)}.`
                : "."}
            </Interpretation>
          )
        }
      >
        {devicesPending ? (
          <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
            Loading devices…
          </p>
        ) : oldestOut.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
            No tablets currently issued.
          </p>
        ) : (
          <ul className={styles.railList}>
            {oldestOut.map((d) => {
              const out = msSinceDate(d.issuedDate, now);
              return (
                <li key={d.id} className={styles.railItem}>
                  <span className={styles.railName} title={d.student}>
                    {d.student}
                  </span>
                  <span className={styles.railWait}>
                    {out === null ? "—" : `${formatElapsedShort(out)} ago`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>

      <KanbanBoard
        title={
          infoRow && meetingInfo
            ? infoRow.meeting?.attended
              ? "Attended meeting"
              : "Booked meeting"
            : "Booked meetings"
        }
        icon={
          <span className="text-amber-500" aria-hidden>
            <CalendarClock size={14} />
          </span>
        }
        count={infoRow && meetingInfo ? undefined : bookedMeetings.length}
        description={
          infoRow && meetingInfo
            ? "Scheduled parent meeting details."
            : "Parent meetings already on the calendar — schedule, venue and invitees."
        }
        className="flex-1"
        actions={
          infoRow && meetingInfo ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setInfoRow(null)}
            >
              Back to list
            </Button>
          ) : undefined
        }
        footer={
          <Interpretation>
            {bookedPending
              ? "Meetings are still loading."
              : bookedMeetings.length === 0
                ? "No parent meetings are on the calendar yet."
                : `${bookedMeetings.length} parent meeting${
                    bookedMeetings.length === 1 ? "" : "s"
                  } on the calendar${
                    firstMeeting
                      ? ` — next on ${formatManilaDateLong(firstMeeting.datetime)} at ${formatManilaTime(firstMeeting.datetime)}`
                      : ""
                  }.`}
          </Interpretation>
        }
      >
        {infoRow && meetingInfo ? (
          <BookedMeetingInfoContent info={meetingInfo} />
        ) : bookedPending ? (
          <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
            Loading meetings…
          </p>
        ) : bookedMeetings.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-1 py-6 text-center text-xs text-muted-foreground">
            No parent meetings booked yet.
          </p>
        ) : (
          <ul className={styles.railList}>
            {bookedMeetings.map((r) => {
              const m = r.meeting;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={styles.bookedRow}
                    onClick={() => setInfoRow(r)}
                  >
                    <span className={styles.railName} title={r.student}>
                      {r.student}
                    </span>
                    <span className={styles.railWait}>
                      {m
                        ? `${formatManilaDateLong(m.datetime)} · ${formatManilaTime(m.datetime)}`
                        : "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>
    </div>
  );
}
