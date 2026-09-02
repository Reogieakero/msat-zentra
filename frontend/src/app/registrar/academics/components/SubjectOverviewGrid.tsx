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
  PolarGrid,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SubjectOverview } from "../api";
import styles from "./subject-overview-grid.module.css";

type GradeFilter = 11 | 12 | "all";

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

  const population = React.useMemo(() => {
    const seen = new Map<number, { gradeLevel: number; total: number; sections: SubjectOverview["enrollments"] }>();
    for (const s of subjects) {
      if (seen.has(s.gradeLevel)) continue;
      seen.set(s.gradeLevel, {
        gradeLevel: s.gradeLevel,
        total: s.enrollments.reduce((sum, e) => sum + e.count, 0),
        sections: s.enrollments,
      });
    }
    return Array.from(seen.values()).sort((a, b) => a.gradeLevel - b.gradeLevel);
  }, [subjects]);

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
                  <span className={styles.gradeTag}>Grade {s.gradeLevel}</span>
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
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        fontSize: "0.75rem",
                      }}
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

      {!loading && population.length > 0 && (
        <section className={styles.population} aria-label="Section population">
          <div className={styles.populationHeading}>
            <h2 className={styles.populationTitle}>Section population</h2>
            <span className={styles.populationSub}>Students per grade level and section</span>
          </div>
          <div className={styles.populationPanel}>
            {population.map((g) => (
              <div key={g.gradeLevel} className={styles.populationGrade}>
                <div className={styles.populationGradeHead}>
                  <span className={styles.populationGradeTag}>Grade {g.gradeLevel}</span>
                  <span className={styles.populationGradeTotal}>
                    {g.total} students
                  </span>
                </div>
                <div className={styles.populationBody}>
                  <div className={styles.populationChart}>
                    <RadialBarChart
                      data={g.sections.map((sec, i) => ({
                        name: sec.name,
                        value: g.total > 0 ? (sec.count / g.total) * 100 : 0,
                        count: sec.count,
                        fill: DONUT_COLORS[i % DONUT_COLORS.length],
                      }))}
                      width={220}
                      height={220}
                      cx={110}
                      cy={110}
                      innerRadius={55}
                      outerRadius={100}
                      barSize={10}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarGrid
                        cx={110}
                        cy={110}
                        innerRadius={55}
                        outerRadius={100}
                        gridType="circle"
                        stroke="var(--border)"
                      />
                      <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        background={{ fill: "var(--muted)" }}
                      />
                    </RadialBarChart>
                    <span className={styles.populationCenter}>
                      <strong>{g.total}</strong>
                      <small>students</small>
                    </span>
                  </div>

                  <ul className={styles.populationLegend}>
                    {g.sections.map((sec, i) => (
                      <li key={sec.id} className={styles.populationLegendItem}>
                        <span
                          className={styles.populationLegendDot}
                          style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                        />
                        <div className={styles.populationLegendBody}>
                          <div className={styles.populationLegendRow}>
                            <span className={styles.populationLegendPct}>
                              {g.total > 0 ? Math.round((sec.count / g.total) * 100) : 0}%
                            </span>
                            <span className={styles.populationLegendName}>
                              - {sec.name}
                            </span>
                          </div>
                          <p className={styles.populationLegendCount}>
                            {sec.count} student{sec.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
