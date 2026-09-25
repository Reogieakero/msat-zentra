import * as React from "react";
import { BookOpen, CalendarRange, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SubjectOverview } from "../api";
import styles from "./subject-overview-grid.module.css";

type GradeFilter = 11 | 12 | "all";

/* Labels start with an upper-case letter — never all lower-case. */
function capitalizeLabel(value: unknown): string {
  return String(value ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TooltipEntry {
  name?: unknown;
  value?: unknown;
  color?: string;
  payload?: { count?: number };
}

/* Theme-token tooltip — popover background/border/foreground text plus a
   series dot, so it stays legible in both dark and light mode instead of
   inheriting the (often unreadable) series fill as text color. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={styles.tooltip}>
      {label !== undefined && (
        <p className={styles.tooltipLabel}>{capitalizeLabel(label)}</p>
      )}
      <ul className={styles.tooltipList}>
        {payload.map((p, i) => {
          const count = p.payload?.count;
          const text =
            typeof count === "number"
              ? `${count} student${count === 1 ? "" : "s"}`
              : String(p.value ?? "");
          return (
            <li key={i} className={styles.tooltipItem}>
              <span
                className={styles.tooltipDot}
                style={p.color ? { backgroundColor: p.color } : undefined}
                aria-hidden
              />
              <span className={styles.tooltipName}>{capitalizeLabel(p.name)}</span>
              <span className={styles.tooltipValue}>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const DONUT_COLORS = [
  "var(--donut-0)",
  "var(--donut-1)",
  "var(--donut-2)",
  "var(--donut-3)",
  "var(--donut-4)",
  "var(--donut-5)",
  "var(--donut-6)",
  "var(--donut-7)",
];

export function SubjectOverviewGrid({
  schoolYear,
  term,
  subjects,
  loading,
}: {
  schoolYear: string | null;
  term: number | null;
  subjects: SubjectOverview[];
  loading: boolean;
}) {
  const [grade, setGrade] = React.useState<GradeFilter>("all");
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (grade === "all") return subjects;
    return subjects.filter((s) => s.gradeLevel === grade);
  }, [subjects, grade]);

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.period}>
          <span className={styles.periodIconWrap}>
            <CalendarRange className={styles.periodIcon} />
          </span>
          <div className={styles.periodText}>
            <span className={styles.periodLabel}>Active period</span>
            <span className={styles.periodValue}>
              {schoolYear ?? "No active school year"}
              {term ? ` · Term ${term}` : ""}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${styles.filterBtn} ${
                grade !== "all" ? styles.filterActive : ""
              }`}
            >
              {grade === "all" ? "All grades" : `Grade ${grade}`}
              {grade !== "all" && <span className={styles.filterDot} aria-hidden />}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.filterMenu}>
            <DropdownMenuCheckboxItem
              checked={grade === "all"}
              onCheckedChange={() => setGrade("all")}
            >
              All grades
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={grade === 11}
              onCheckedChange={() => setGrade(11)}
            >
              Grade 11
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={grade === 12}
              onCheckedChange={() => setGrade(12)}
            >
              Grade 12
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skelCard}`}>
              <div className={styles.skelHeader}>
                <span className={styles.skelCode} />
                <span className={styles.skelName} />
              </div>
              <div className={styles.skelBody}>
                <span className={styles.skelDonut} />
                <div className={styles.skelLines}>
                  <span className={styles.skelLine} />
                  <span className={styles.skelLine} />
                  <span className={styles.skelLine} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <BookOpen className={styles.emptyIcon} />
          <p className={styles.emptyText}>No subjects for the selected grade level.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => (
            <article
              key={s.id}
              className={`${styles.card} ${selectedCode === s.code ? styles.cardSelected : ""}`}
              onClick={() =>
                setSelectedCode((prev) => (prev === s.code ? null : s.code))
              }
            >
              <header className={styles.cardHeader}>
                <div className={styles.codeWrap}>
                  <span className={styles.code}>{s.code}</span>
                </div>
                <div className={styles.cardTitleBlock}>
                  <h3 className={styles.cardTitle}>{s.name}</h3>
                  <span className={styles.gradeTag}>Grade {s.gradeLevel} · {s.category}</span>
                </div>
              </header>

              <div className={styles.enrolledRow}>
                <Users className={styles.enrolledIcon} />
                <span className={styles.enrolledCount}>{s.enrolled}</span>
                <span className={styles.enrolledLabel}>enrolled</span>
              </div>

              <div className={styles.barWrap}>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={s.enrollments.map((e, i) => ({
                      ...e,
                      fill: DONUT_COLORS[i % DONUT_COLORS.length],
                    }))}
                    margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      content={<ChartTooltip />}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {s.enrollments.map((e, i) => (
                        <Cell key={e.id} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                className={`${styles.expand} ${selectedCode === s.code ? styles.expandOpen : ""}`}
              >
                {s.enrollments
                  .map((e) => `${e.name} (${e.count})`)
                  .join("  ·  ")}
              </div>
            </article>
          ))}
        </div>
      )}

    </div>
  );
}
