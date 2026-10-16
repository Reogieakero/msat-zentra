"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GraduationCap,
  GripVertical,
  ShieldAlert,
  User,
} from "lucide-react";
import { Cell, RadialBar, RadialBarChart } from "recharts";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useTeacherProfileSettings } from "@/services/settings/profile-settings";
import type { AdvisorySectionInfo } from "@/services/teacher/overview.types";
import styles from "./teacher-overview-kanban.module.css";

const RISK_COLORS = { academic: "#f59e0b", attendance: "#22c55e", behavioral: "#3b82f6" };

interface RiskFactors {
  academic: number;
  attendance: number;
  behavioral: number;
}

interface RiskItem {
  id: keyof RiskFactors;
  name: string;
  count: number;
  pct: number;
  fill: string;
}

function usePersistedOrder(storageKey: string, ids: string[]): [string[], React.Dispatch<React.SetStateAction<string[]>>, boolean, () => void] {
  const [order, setOrder] = React.useState<string[]>(ids);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        if (Array.isArray(saved)) {
          const kept = saved.filter((id) => ids.includes(id));
          const added = ids.filter((id) => !kept.includes(id));
          setOrder([...kept, ...added]);
        } else {
          setOrder(ids);
        }
      } else {
        setOrder(ids);
      }
    } catch {
      setOrder(ids);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, ids.join("|")]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(order));
    } catch {
      // ignore quota errors
    }
  }, [storageKey, order, hydrated]);

  const isCustom = hydrated && (order.length !== ids.length || order.some((id, i) => id !== ids[i]));
  const reset = React.useCallback(() => setOrder(ids), [ids]);
  return [order, setOrder, isCustom, reset];
}

function SortableCard({ id, children, label }: { id: string; children: React.ReactNode; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-w-0 gap-2 rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/60 dark:bg-card ${isDragging ? "border-primary opacity-55" : ""}`}
      aria-label={label}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
      <span
        className="inline-flex h-fit shrink-0 cursor-grab touch-none items-center text-muted-foreground"
        aria-label={`Drag ${label} to reorder`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden />
      </span>
    </li>
  );
}

function RiskLane({
  factors,
  total,
  atRisk,
  hideBehavioral,
  storageKey,
}: {
  factors: RiskFactors;
  total: number;
  atRisk: number;
  hideBehavioral: boolean;
  storageKey: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const all: RiskItem[] = React.useMemo(
    () => [
      { id: "academic", name: "Academic", count: factors.academic, pct: Math.min(100, (factors.academic / safeTotal) * 100), fill: RISK_COLORS.academic },
      { id: "attendance", name: "Attendance", count: factors.attendance, pct: Math.min(100, (factors.attendance / safeTotal) * 100), fill: RISK_COLORS.attendance },
      { id: "behavioral", name: "Behavioral", count: factors.behavioral, pct: Math.min(100, (factors.behavioral / safeTotal) * 100), fill: RISK_COLORS.behavioral },
    ],
    [factors.academic, factors.attendance, factors.behavioral, safeTotal],
  );
  const visible = React.useMemo(() => (hideBehavioral ? all.filter((r) => r.id !== "behavioral") : all), [all, hideBehavioral]);
  const ids = React.useMemo(() => visible.map((r) => r.id), [visible]);
  const [order, setOrder, isCustom, resetOrder] = usePersistedOrder(`${storageKey}:risk`, ids);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = React.useMemo(() => new Map(visible.map((r) => [r.id, r])), [visible]);
  const ordered = React.useMemo(
    () => order.map((id) => byId.get(id as keyof RiskFactors)).filter((r): r is RiskItem => !!r),
    [order, byId],
  );
  const sortableRiskIds = React.useMemo(() => ordered.map((r) => r.id), [ordered]);
  const pct = total > 0 ? Math.min(100, Math.round((atRisk / safeTotal) * 100)) : 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const sortable = prev.filter((id) => byId.has(id as keyof RiskFactors));
      const from = sortable.indexOf(String(active.id));
      const to = sortable.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      const moved = arrayMove(sortable, from, to);
      const stale = prev.filter((id) => !byId.has(id as keyof RiskFactors));
      return [...moved, ...stale];
    });
  }

  return (
    <KanbanBoard
      title="Needs attention"
      icon={
        <span className="text-amber-500" aria-hidden>
          <ShieldAlert size={14} />
        </span>
      }
      count={atRisk}
      description="Drag cards to prioritize · saved on this device"
      actions={
        isCustom ? (
          <button type="button" className={styles.resetBtn} onClick={resetOrder}>
            Reset
          </button>
        ) : ordered.length > 1 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <GripVertical size={12} aria-hidden /> drag
          </span>
        ) : null
      }
      ariaLabel={`Needs attention, ${atRisk}`}
      className="bg-muted/60 [font-family:var(--font-inter)] dark:bg-muted/20"
    >
      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
        <RadialBarChart data={visible} width={84} height={84} cx={42} cy={42} innerRadius={24} outerRadius={38} barSize={6} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="pct" cornerRadius={6} background={{ fill: "var(--muted)" }}>
            {visible.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} />
            ))}
          </RadialBar>
        </RadialBarChart>
        <span className={styles.riskSummaryText}>
          <strong>{pct}%</strong>
          <small>at risk · {atRisk} of {total}</small>
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableRiskIds} strategy={verticalListSortingStrategy}>
          <ul className={styles.laneBody}>
            {ordered.map((row) => (
              <SortableCard key={row.id} id={row.id} label={`${row.name} risk, ${row.count} students`}>
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.fill }} aria-hidden />
                  <span className="truncate">{row.name}</span>
                  <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {Math.round(row.pct)}%
                  </span>
                </span>
                <p className="text-xs leading-snug text-muted-foreground">
                  {row.count} student{row.count === 1 ? "" : "s"} of {total}
                </p>
                <span
                  className={styles.progress}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(row.pct)}
                  aria-label={`${row.name} risk: ${row.count} of ${total} students`}
                >
                  <span
                    className={styles.progressFill}
                    style={{ width: `${Math.round(row.pct)}%`, backgroundColor: row.fill }}
                  />
                </span>
              </SortableCard>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </KanbanBoard>
  );
}

export interface TeacherOverviewKanbanProps {
  teacherName: string;
  advisorySection?: AdvisorySectionInfo | null;
  classCount?: number;
  studentCount?: number;
  atRiskFactors?: RiskFactors;
  atRiskStudents?: number;
  populationLabel?: string;
  hideBehavioral?: boolean;
  storageKey: string;
}

export function TeacherOverviewKanban({
  teacherName,
  advisorySection,
  classCount = 0,
  studentCount = 0,
  atRiskFactors,
  atRiskStudents = 0,
  populationLabel = "students",
  hideBehavioral = false,
  storageKey,
}: TeacherOverviewKanbanProps) {
  const profile = useTeacherProfileSettings();
  const photoUrl = profile.data?.photoUrl ?? null;
  const mascot = profile.data?.mascot ?? null;
  const isAdviser = Boolean(advisorySection);
  const initials = React.useMemo(() => {
    const parts = teacherName
      .split(/\s+/)
      .filter(Boolean)
      .filter((p) => !/^mr\.?$|^mrs\.?$|^ms\.?$|^dr\.?$/i.test(p));
    const picks = parts.slice(0, 2);
    return (picks.length ? picks : [teacherName]).map((p) => p[0]?.toUpperCase() ?? "").join("");
  }, [teacherName]);
  const risk = atRiskFactors ?? { academic: 0, attendance: 0, behavioral: 0 };

  return (
    <div className="flex min-w-0 flex-col gap-4" aria-label="My day board">
      <KanbanBoard
        title="Profile"
        icon={
          <span className="text-emerald-600" aria-hidden>
            <User size={14} />
          </span>
        }
        ariaLabel="Profile"
        className="bg-muted/60 [font-family:var(--font-inter)] dark:bg-muted/20"
      >
        <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
          <div className={styles.profileTop}>
            {mascot ? (
              <span className="shrink-0 overflow-hidden rounded-full border border-border bg-muted/40">
                <StudentMascot name={teacherName} character={mascot} size={40} />
              </span>
            ) : photoUrl ? (
              <img src={photoUrl} alt={`${teacherName} profile photo`} className={styles.avatarImg} />
            ) : (
              <span className={styles.avatar} aria-hidden>{initials || "T"}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className={styles.profileName} title={teacherName}>{teacherName}</p>
            </div>
            <span className={styles.profileRole}>{isAdviser ? "Adviser" : "Teacher"}</span>
          </div>
          {isAdviser && advisorySection ? (
            <p className={styles.profileAdvisory}>
              <GraduationCap aria-hidden /> Adviser of <strong>{advisorySection.name}</strong>
            </p>
          ) : (
            <p className={styles.profileAdvisory}>
              <ShieldAlert size={14} aria-hidden /> No advisory section this term.
            </p>
          )}
          <div className={styles.profileStats}>
            <span className={styles.profileStat}>
              <span className={`${styles.profileStatValue} border-blue-500/40 bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400`}>{classCount}</span>
              <span className={styles.profileStatLabel}>Classes</span>
            </span>
            <span className={styles.profileStat}>
              <span className={`${styles.profileStatValue} border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400`}>{studentCount}</span>
              <span className={styles.profileStatLabel}>{populationLabel}</span>
            </span>
          </div>
        </div>
      </KanbanBoard>

      <RiskLane
        factors={risk}
        total={studentCount}
        atRisk={atRiskStudents}
        hideBehavioral={hideBehavioral}
        storageKey={storageKey}
      />
    </div>
  );
}
