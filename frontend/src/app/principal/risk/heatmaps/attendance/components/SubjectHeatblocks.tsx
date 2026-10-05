"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarRange, Check, ChevronDown, Users } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SectionScheduleCard,
  SECTION_CARD_STATUS_META,
} from "@/components/schedule/SectionScheduleCard";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./AttendanceHeatblocks.module.css";

type SubjectMeta = {
  subjectId: string;
  code: string;
  name: string;
};

type Cell = {
  subjectId: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  ratio: number;
};

type Day = {
  date: string;
  isoDate: string;
  isWeekend: boolean;
  cells: Cell[];
};

type Row = {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  subjects: SubjectMeta[];
  days: Day[];
};

// Brand-derived scale mirrors the attendance map tokens (--hm-*).
const SCALE = "var(--hm-0) var(--hm-1) var(--hm-2) var(--hm-3) var(--hm-4)".split(" ");

// Color by the canonical present ratio (0..100) computed by the backend engine.
function ratioColor(ratio: number): string {
  if (ratio <= 0) return SCALE[0];
  if (ratio >= 90) return SCALE[4];
  if (ratio >= 80) return SCALE[3];
  if (ratio >= 50) return SCALE[2];
  return SCALE[1];
}

export const ALL_SUBJECTS = "__all__";
const ALL_GRADES = "__all__";
const ALL_SECTIONS = "__all__";

function shortSection(name: string): string {
  return name.replace(/^Grade\s+/i, "");
}

// Status dot for one subject card: average present ratio across its days.
// No takes at all reads as neutral (same empty-token language as the blocks).
function cardStatus(
  section: Row,
  i: number
): { color: string; label: string } {
  const cells = section.days
    .map((d) => d.cells[i])
    .filter((c): c is Cell => !!c);
  const hasTakes = cells.some((c) => c.total > 0);
  if (!hasTakes)
    return { color: SECTION_CARD_STATUS_META.empty.color, label: "No takes" };
  const avg =
    cells.reduce((sum, c) => sum + c.ratio, 0) / Math.max(1, cells.length);
  if (avg >= 80)
    return { color: SECTION_CARD_STATUS_META.approved.color, label: "On track" };
  if (avg >= 50)
    return { color: SECTION_CARD_STATUS_META.returned.color, label: "Mixed" };
  return { color: SECTION_CARD_STATUS_META.draft.color, label: "Low" };
}

function FilterDropdown({
  label,
  display,
  children,
}: {
  label: string;
  display: string;
  children: React.ReactNode;
}) {
  return (
    <span className={styles.filterField}>
      <span className={styles.filterFieldLabel}>{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
            className={styles.filterBtn}
          >
            {display}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.filterMenu}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function FilterItem({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      {active ? <Check aria-hidden /> : <span className={styles.checkSpacer} />}
      <span>{children}</span>
    </DropdownMenuItem>
  );
}

export function SubjectHeatblocks({
  onInspectSection,
}: {
  onInspectSection: (sectionId: string, sectionName: string) => void;
}) {
  // Draft picks (dropdowns only edit these — nothing fetches/displays yet).
  const [grade, setGrade] = React.useState<string>(ALL_GRADES);
  const [sectionId, setSectionId] = React.useState<string>(ALL_SECTIONS);
  const [subjectId, setSubjectId] = React.useState<string>(ALL_SUBJECTS);
  // Applied filters: copied from the drafts when the Filter button is
  // pressed. The grid only ever renders the applied set.
  const [applied, setApplied] = React.useState({
    grade: ALL_GRADES,
    sectionId: ALL_SECTIONS,
    subjectId: ALL_SUBJECTS,
  });
  const [submitted, setSubmitted] = React.useState(false);
  // Gate: the grid stays hidden until Filter is pressed — the page never
  // dumps all sections at once. Picks live in the filter modal; applying
  // copies the drafts into `applied` and reveals the grid.
  const [filterOpen, setFilterOpen] = React.useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-subject-heatmap", "all"],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: Row[];
        subjects: SubjectMeta[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-subject-heatmap");
      return res.data;
    },
    staleTime: 30_000,
  });
  const termNumber = data?.term?.termNumber;

  const allSections = React.useMemo(() => data?.sections ?? [], [data]);
  const allSubjects = React.useMemo(() => data?.subjects ?? [], [data]);
  const grades = React.useMemo(
    () =>
      [...new Set(allSections.map((s) => s.gradeLevel))].sort(
        (a, b) => Number(a) - Number(b)
      ),
    [allSections]
  );

  // Cascading filters: grade narrows the section list; section narrows nothing
  // else; subject narrows the rows inside each card. Everything filters
  // client-side from the single fetch above.
  const sectionOptions = React.useMemo(
    () =>
      allSections.filter((s) => grade === ALL_GRADES || s.gradeLevel === grade),
    [allSections, grade]
  );
  React.useEffect(() => {
    if (sectionId !== ALL_SECTIONS && !sectionOptions.some((s) => s.sectionId === sectionId)) {
      setSectionId(ALL_SECTIONS);
    }
  }, [sectionOptions, sectionId]);

  const sections = React.useMemo(
    () =>
      allSections.filter(
        (s) =>
          (applied.grade === ALL_GRADES || s.gradeLevel === applied.grade) &&
          (applied.sectionId === ALL_SECTIONS || s.sectionId === applied.sectionId)
      ),
    [allSections, applied]
  );

  // One grid card per subject (never subjects crammed into one section
  // card). Sections with no visible subjects get a single info card.
  type Card = { key: string; section: Row; sub: SubjectMeta | null; i: number };
  const cards: Card[] = React.useMemo(
    () =>
      sections.flatMap((s): Card[] => {
        const visible = s.subjects
          .map((sub, i) => ({ sub, i }))
          .filter(
            ({ sub }) =>
              applied.subjectId === ALL_SUBJECTS ||
              sub.subjectId === applied.subjectId
          );
        if (visible.length === 0) {
          return [{ key: s.sectionId, section: s, sub: null, i: -1 }];
        }
        return visible.map(({ sub, i }) => ({
          key: `${s.sectionId}|${sub.subjectId}`,
          section: s,
          sub,
          i,
        }));
      }),
    [sections, applied.subjectId]
  );

  const gradeDisplay =
    grade === ALL_GRADES ? "All grades" : `Grade ${grade}`;
  const sectionDisplay =
    sectionId === ALL_SECTIONS
      ? "All sections"
      : shortSection(
          allSections.find((s) => s.sectionId === sectionId)?.section ?? "All sections"
        );
  const subjectDisplay =
    subjectId === ALL_SUBJECTS
      ? "All subjects"
      : (allSubjects.find((s) => s.subjectId === subjectId)?.name ?? "All subjects");

  function applyFilters() {
    setApplied({ grade, sectionId, subjectId });
    setSubmitted(true);
    setFilterOpen(false);
  }

  const gated = !submitted;

  // Draft picks only — applying happens in the modal footer.
  const picker = (
    <div className={styles.filterBar} role="group" aria-label="Subject view filters">
      <FilterDropdown label="Grade" display={gradeDisplay}>
        <FilterItem active={grade === ALL_GRADES} onSelect={() => setGrade(ALL_GRADES)}>
          All grades
        </FilterItem>
        {grades.map((g) => (
          <FilterItem key={g} active={grade === g} onSelect={() => setGrade(g)}>
            Grade {g}
          </FilterItem>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Section" display={sectionDisplay}>
        <FilterItem
          active={sectionId === ALL_SECTIONS}
          onSelect={() => setSectionId(ALL_SECTIONS)}
        >
          All sections
        </FilterItem>
          {sectionOptions.map((s) => (
            <FilterItem
              key={s.sectionId}
              active={sectionId === s.sectionId}
              onSelect={() => setSectionId(s.sectionId)}
            >
              {shortSection(s.section)} · {s.enrolled} students
            </FilterItem>
          ))}
      </FilterDropdown>
      <FilterDropdown label="Subject" display={subjectDisplay}>
        <FilterItem
          active={subjectId === ALL_SUBJECTS}
          onSelect={() => setSubjectId(ALL_SUBJECTS)}
        >
          All subjects
        </FilterItem>
        {allSubjects.map((s) => (
          <FilterItem
            key={s.subjectId}
            active={subjectId === s.subjectId}
            onSelect={() => setSubjectId(s.subjectId)}
          >
            {s.name} ({s.code})
          </FilterItem>
        ))}
      </FilterDropdown>
    </div>
  );

  return (
    <>
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Subjects &amp; Sessions Heatblocks</CardTitle>
          <CardDescription>
            Per-section, per-day blocks for each subject — one row per subject.
          </CardDescription>
        </div>
        {termNumber ? (
          <CardAction>
            <Badge variant="secondary">Term {termNumber}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
      {!isPending && !gated ? (
        <div className={styles.activeBar}>
          <Button
            type="button"
            variant="default"
            size="sm"
            className={styles.changeBtn}
            onClick={() => setFilterOpen(true)}
          >
            Change filter
          </Button>
        </div>
      ) : null}
      {isPending ? (
          <div className={styles.gridCards}>
            {Array.from({ length: 6 }).map((_, i) => (
              <article key={i} className={styles.cardShell} aria-hidden>
                <Skeleton className={styles.skelGrade} />
                <div className={styles.subjectGrid}>
                  <Skeleton className={styles.skelSubject} />
                  <div className={styles.grid}>
                    {Array.from({ length: 36 }).map((__, j) => (
                      <Skeleton key={j} className={styles.skelBlock} />
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : gated ? (
          <div className={styles.gate}>
            <p className={styles.gateTitle}>Narrow the view to begin</p>
            <p className={styles.gateBody}>
              Pick a grade level, section, or subject, then press Filter
              to display the matching blocks.
            </p>
            <Button type="button" onClick={() => setFilterOpen(true)}>
              Choose filters
            </Button>
          </div>
        ) : sections.length === 0 && allSections.length === 0 ? (
          <p className={styles.empty}>No attendance data available.</p>
        ) : (
          <TooltipProvider>
            <div className={styles.gridCards}>
              {sections.length === 0 ? (
                <p className={styles.empty}>
                  No sections match the selected grade and section.
                </p>
              ) : null}
              {cards.map((c) => {
                if (!c.sub) {
                  return (
                    <SectionScheduleCard
                      key={c.key}
                      ariaLabel={`${c.section.section} — no subject attendance yet`}
                      avatarIcon={<BookOpen size={20} aria-hidden />}
                      titleLabel="Section"
                      sectionName={c.section.section}
                      adviserName={null}
                      statusMeta={{
                        color: SECTION_CARD_STATUS_META.empty.color,
                        label: "Empty",
                      }}
                      middle={
                        <span className={styles.cardMeta}>
                          <span className={styles.enrolled}>
                            <CalendarRange
                              className={styles.enrolledIcon}
                              aria-hidden
                            />
                            {c.section.enrolled} students
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              onInspectSection(
                                c.section.sectionId,
                                c.section.section
                              )
                            }
                            aria-label={`Show per-student attendance for ${c.section.section}`}
                            title={`Show per-student attendance for ${c.section.section}`}
                          >
                            <Users size={14} aria-hidden />
                          </Button>
                        </span>
                      }
                      hint="No subject attendance yet."
                    />
                  );
                }
                const meta = cardStatus(c.section, c.i);
                return (
                  <SectionScheduleCard
                    key={c.key}
                    ariaLabel={`${c.sub.name} in ${c.section.section} — ${meta.label}`}
                    pill={
                      <Badge variant="secondary" className={assign.gradeFloat}>
                        {c.sub.code}
                      </Badge>
                    }
                    avatarIcon={<BookOpen size={20} aria-hidden />}
                    titleLabel="Subject"
                    sectionName={c.sub.name}
                    adviserName={null}
                    statusMeta={meta}
                    middle={
                      <span className={styles.cardMeta}>
                        <span className={styles.enrolled}>
                          <CalendarRange
                            className={styles.enrolledIcon}
                            aria-hidden
                          />
                          {c.section.section} · {c.section.enrolled} students
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            onInspectSection(
                              c.section.sectionId,
                              c.section.section
                            )
                          }
                          aria-label={`Show per-student attendance for ${c.section.section}`}
                          title={`Show per-student attendance for ${c.section.section}`}
                        >
                          <Users size={14} aria-hidden />
                        </Button>
                      </span>
                    }
                  >
                    <div className={styles.grid}>
                      {c.section.days.map((d) => {
                        const cell = d.cells[c.i];
                        return (
                          <Tooltip key={d.isoDate}>
                            <TooltipTrigger asChild>
                              <span
                                className={`${styles.block} ${
                                  d.isWeekend ? styles.blockWeekend : ""
                                }`}
                                style={{
                                  background: d.isWeekend
                                    ? "var(--hm-weekend)"
                                    : ratioColor(cell?.ratio ?? 0),
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className={styles.tooltipLine}>
                                <span>
                                  {c.sub!.name} &middot; {c.section.section} &middot; {d.date}
                                </span>
                                <span>
                                  {cell?.present ?? 0} present &middot;{" "}
                                  {cell?.late ?? 0} late &middot;{" "}
                                  {cell?.absent ?? 0} absent &middot;{" "}
                                  {cell?.excused ?? 0} excused
                                </span>
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </SectionScheduleCard>
                );
              })}
                </div>
            <div className={styles.legend}>
              <span className={styles.legendLabel}>Present: 0</span>
              <span className={styles.legendSwatches}>
                {SCALE.map((c, i) => (
                  <span
                    key={i}
                    className={styles.legendSwatch}
                    style={{ background: c }}
                  />
                ))}
              </span>
              <span className={styles.legendLabel}>= enrolled</span>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
    <CardModal
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      size="md"
      title="Filter subject blocks"
      description="Pick a grade level, section, or subject, then show the matching blocks."
      watchKey={`${grade}|${sectionId}|${subjectId}`}
    >
      {picker}
      <div className={styles.modalActions}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setFilterOpen(false)}
        >
          Cancel
        </Button>
        <Button type="button" onClick={applyFilters}>
          Show results
        </Button>
      </div>
    </CardModal>
    </>
  );
}
