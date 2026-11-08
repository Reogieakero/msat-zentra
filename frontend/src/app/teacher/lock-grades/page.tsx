"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/pagination";
import { useTerm } from "@/lib/term/TermContext";
import { useLockGrades, type LockGradesView } from "@/services/teacher/lockGrades.service";
import { FilterTabs } from "@/app/teacher/advisory/interventions/components/filter-tabs";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { LockGradesClassCard } from "./components/class-card";
import { LockGradesAdviseeCard } from "./components/advisee-card";
import styles from "./components/lock-grades.module.css";

const ADVISEES_PAGE_SIZE = 15;

function GateCard({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <TeacherEmptyCard
      centered
      icon={KeyRound}
      title={title}
      hint={description}
      label="Lock grades"
      action={
        <Button asChild size="sm">
          <Link href="/teacher/classes">{actionLabel}</Link>
        </Button>
      }
    />
  );
}

function BoardSkeleton() {
  return (
    <div className={styles.skelGrid} aria-busy="true" aria-label="Loading lock grades">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.skelCard}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-48" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

const MODE_OPTIONS: { value: LockGradesView; label: string }[] = [
  { value: "classes", label: "My Classes" },
  { value: "advisees", label: "My Advisees" },
];

function ClassesMode() {
  const query = useLockGrades("classes");
  const { activeTerm } = useTerm();
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";

  if (query.isPending && !query.data) return <BoardSkeleton />;

  if (query.isError || !query.data) {
    return <p className={styles.error}>Could not load your classes. Check your connection and try again.</p>;
  }

  const data = query.data;
  if (!data.isSubjectTeacher) {
    return (
      <TeacherEmptyCard
        centered
        icon={Lock}
        title="No classes assigned yet"
        hint="Lock grades for the subjects you teach. Link your teacher code on the classes page or ask your registrar to assign your subjects and sections first."
        label="Lock grades"
      />
    );
  }

  if (!data.gates.linked) {
    return (
      <GateCard
        title="Link code"
        description="Your classes will appear here only after you link your teacher code on the classes page."
        actionLabel="Go to classes to link code"
      />
    );
  }

  if (!data.gates.termGrant) {
    return (
      <GateCard
        title="Enter term"
        description="Your classes will appear here only after you enter this term's code on the classes page."
        actionLabel="Go to classes to enter code"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.classes.length === 0 ? (
        <TeacherEmptyCard
          centered
          icon={Lock}
          title="No classes assigned yet"
          hint="Ask your registrar to assign your subjects and sections for this term."
          label="Lock grades"
        />
      ) : (
        <div className={`${styles.grid} ${styles.gridEnter}`}>
          {data.classes.map((row) => (
            <LockGradesClassCard key={row.id} row={row} termLabel={termLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdviseesMode() {
  const query = useLockGrades("advisees");
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  if (query.isPending && !query.data) return <BoardSkeleton />;

  if (query.isError || !query.data) {
    return (
      <TeacherEmptyCard
        centered
        icon={Lock}
        title="No advisory section assigned"
        hint="Advisee lock statuses are scoped to your advisory section. Claim your advisory in Settings, then come back."
        label="Lock grades"
      />
    );
  }

  const data = query.data;
  if (!data.isAdviser || data.advisorySections.length === 0) {
    return (
      <TeacherEmptyCard
        centered
        icon={Lock}
        title="No advisory section assigned"
        hint="Claim your advisory in Settings to see your advisees' subject lock statuses here."
        label="Lock grades"
      />
    );
  }

  const needle = search.trim().toLowerCase();
  const filtered = data.advisees.filter((row) => {
    if (sectionId !== "all" && row.sectionId !== sectionId) return false;
    if (needle && !`${row.name} ${row.lrn} ${row.section}`.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADVISEES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * ADVISEES_PAGE_SIZE,
    safePage * ADVISEES_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={styles.toolbar}>
        {data.advisorySections.length > 1 ? (
          <Select
            value={sectionId}
            onValueChange={(value) => {
              setSectionId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-48 text-xs" aria-label="Advisory section">
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {data.advisorySections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search advisee or LRN…"
          aria-label="Search advisee or LRN"
          className="h-8 w-64 max-w-full text-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} advisee{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <TeacherEmptyCard
          centered
          icon={Lock}
          title={needle || sectionId !== "all" ? "No matching advisees" : "No advisees yet"}
          hint={
            needle || sectionId !== "all"
              ? "No advisees match your filters."
              : "Learners from your advisory section will appear here once they are enrolled."
          }
          label="Lock grades"
        />
      ) : (
        <>
          <div className={`${styles.grid} ${styles.gridEnter}`}>
            {pageRows.map((row) => (
              <LockGradesAdviseeCard key={row.studentId} row={row} />
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
            pageSize={ADVISEES_PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function TeacherLockGradesPage() {
  const classesQuery = useLockGrades("classes");
  const [mode, setMode] = React.useState<LockGradesView>("classes");

  // An adviser-only teacher opens straight on the read-only advisee board.
  const data = classesQuery.data;
  const canTeach = data?.isSubjectTeacher ?? false;
  const canAdvise = data?.isAdviser ?? false;
  const effectiveMode: LockGradesView =
    canTeach || !canAdvise ? mode : "advisees";

  return (
    <section className={styles.page} aria-label="Lock grades">
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Lock Grades</h1>
          <p className={styles.sub}>
            Lock final grades for your classes, or review your advisees&apos; lock statuses —
            read-only.
          </p>
        </div>
        {canTeach && canAdvise ? (
          <FilterTabs
            label="Lock grades mode"
            options={MODE_OPTIONS}
            value={effectiveMode}
            onChange={setMode}
            tone="blue"
          />
        ) : null}
      </div>

      {effectiveMode === "classes" ? <ClassesMode /> : <AdviseesMode />}
    </section>
  );
}
