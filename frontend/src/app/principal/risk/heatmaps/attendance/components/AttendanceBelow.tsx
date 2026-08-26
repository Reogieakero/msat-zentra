import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  mockSectionStats,
  mockAttendanceTrend,
  type SectionAttendanceStat,
  type TrendPoint,
} from "../../components/mockData";
import styles from "./below.module.css";

interface SectionStudent {
  id: string;
  lrn: string;
  name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
}

export function AttendanceBelow({
  selectedSectionId,
  onClearSection,
  session,
}: {
  selectedSectionId?: string | null;
  onClearSection?: () => void;
  session: "AM" | "PM";
}) {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<SectionAttendanceStat[]>([]);
  const [trend, setTrend] = React.useState<TrendPoint[]>([]);
  const [students, setStudents] = React.useState<SectionStudent[]>([]);
  const [sectionLabel, setSectionLabel] = React.useState<string>("");
  const [schoolDays, setSchoolDays] = React.useState<number>(0);

  const isDrillDown = Boolean(selectedSectionId);

  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });

    // Always fetch the trend for the current session, scoped to the selected
    // section when one is chosen, so the line graph matches the heatblocks.
    const statsReq = apiClient
      .get<{ sections: SectionAttendanceStat[]; trend: TrendPoint[]; schoolDays: number }>(
        "/api/attendance/section-stats",
        { params: { session, ...(selectedSectionId ? { sectionId: selectedSectionId } : {}) } }
      )
      .then((res) => {
        if (!cancelled) {
          setStats(res.data.sections);
          setTrend(res.data.trend);
          setSchoolDays(res.data.schoolDays ?? 0);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("[/api/attendance/section-stats] fetch failed:", err);
          setStats(mockSectionStats());
          setTrend(mockAttendanceTrend(selectedSectionId));
        }
      });

    // When a section is selected, also load its roster for the drill-down table.
    const studentsReq = selectedSectionId
      ? apiClient
          .get<{ section: string; schoolDays: number; students: SectionStudent[] }>(
            `/api/attendance/sections/${selectedSectionId}/students`,
            { params: { session } }
          )
          .then((res) => {
            if (!cancelled) {
              setStudents(res.data.students);
              setSectionLabel(res.data.section);
              setSchoolDays(res.data.schoolDays ?? 0);
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              console.error("[/api/attendance/sections/:id/students] fetch failed:", err);
              setStudents([]);
            }
          })
      : Promise.resolve();

    Promise.all([statsReq, studentsReq]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSectionId, session]);

  const pct = (s: SectionAttendanceStat) =>
    s.enrolled > 0 ? (s.rate / s.enrolled) * 100 : 0;

  const sorted = React.useMemo(
    () => [...stats].sort((a, b) => a.rate - b.rate),
    [stats]
  );
  const alerts = stats.filter((s) => pct(s) < 80).sort((a, b) => a.rate - b.rate);
  const maxBelow = Math.max(1, ...stats.map((s) => s.belowDays));

  const studentAlerts = students
    .filter((s) => s.rate < 80)
    .sort((a, b) => a.rate - b.rate);

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.panelHead}>
          <h3 className={styles.panelTitle}>
            {isDrillDown ? `Section attendance · ${sectionLabel}` : "Section attendance"}
          </h3>
          {isDrillDown ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => onClearSection?.()}
            >
              <X size={13} aria-hidden /> Clear
            </button>
          ) : null}
        </div>

        <div className={styles.split}>
          <div className={styles.left}>
            <div className={styles.tableWrap}>
              {loading ? (
                <div className={styles.tableSkel}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className={styles.tableSkelRow} />
                  ))}
                </div>
              ) : isDrillDown ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colLeft}>Student</th>
                      <th>LRN</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Excused</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td className={styles.colLeft} colSpan={7}>
                          No students in this section.
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => (
                        <tr key={s.id}>
                          <td className={styles.colLeft}>{s.name}</td>
                          <td className={styles.mono}>{s.lrn}</td>
                          <td className={styles.mono}>{s.present}</td>
                          <td className={styles.mono}>{s.late}</td>
                          <td className={styles.mono}>{s.absent}</td>
                          <td className={styles.mono}>{s.excused}</td>
                          <td>
                            <span className={styles.rate} data-low={s.rate < 80}>
                              {s.rate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colLeft}>Section</th>
                      <th>Enrolled</th>
                      <th>Avg present/day</th>
                      <th>Below 80%</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => (
                      <tr key={s.sectionId}>
                        <td className={styles.colLeft}>{s.section}</td>
                        <td className={styles.mono}>{s.enrolled}</td>
                        <td>
                          <span className={styles.rate} data-low={pct(s) < 80}>
                            {s.rate}
                            <span className={styles.rateSub}> / {s.enrolled} avg</span>
                          </span>
                        </td>
                        <td>
                          <span className={styles.belowTrack}>
                            <span
                              className={styles.belowFill}
                              style={{ width: `${(s.belowDays / maxBelow) * 100}%` }}
                            />
                          </span>
                          <span className={styles.belowNum}>{s.belowDays}</span>
                        </td>
                        <td>
                          <TrendIcon trend={s.trend} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className={styles.right} id="trend">
            <p className={styles.chartTitle}>
              {isDrillDown ? `Attendance trend · ${sectionLabel}` : "School-wide trend · all sections (present count)"}
            </p>
            {loading ? (
              <Skeleton className={styles.chartSkel} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    domain={[0, (max: number) => Math.max(5, Math.ceil(max / 5) * 5)]}
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                    formatter={(v) => [`${v} present`, "Attendance"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="present"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            <aside className={styles.alerts}>
              <p className={styles.alertsHead}>
                <TriangleAlert size={13} /> Needs attention
              </p>
              {loading ? (
                <div className={styles.alertSkel}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={styles.alertSkelRow} />
                  ))}
                </div>
              ) : isDrillDown ? (
                studentAlerts.length === 0 ? (
                  <p className={styles.alertEmpty}>All students above 80%.</p>
                ) : (
                  <ul className={styles.alertList}>
                    {studentAlerts.slice(0, 5).map((s) => (
                      <li key={s.id} className={styles.alertItem}>
                        <span className={styles.alertName}>{s.name}</span>
                        <span className={styles.alertRate}>{s.rate}%</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : alerts.length === 0 ? (
                <p className={styles.alertEmpty}>All sections above 80%.</p>
              ) : (
                <ul className={styles.alertList}>
                  {alerts.slice(0, 5).map((s) => (
                    <li key={s.sectionId} className={styles.alertItem}>
                      <span className={styles.alertName}>{s.section}</span>
                      <span className={styles.alertRate}>{s.rate}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </div>
        {!loading ? (
          <p className={styles.schoolDays}>
            {schoolDays} school days · term start → today
          </p>
        ) : null}
      </section>
    </div>
  );
}

function TrendIcon({ trend }: { trend: SectionAttendanceStat["trend"] }) {
  if (trend === "up")
    return <ArrowUpRight size={15} className={styles.trendUp} aria-label="improving" />;
  if (trend === "down")
    return <ArrowDownRight size={15} className={styles.trendDown} aria-label="declining" />;
  return <Minus size={15} className={styles.trendFlat} aria-label="steady" />;
}
