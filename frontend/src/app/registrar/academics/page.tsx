"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, RefreshCw, BookOpen, UserRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfigureSection } from "./components/ConfigureSection";
import { SubjectOverviewGrid } from "./components/SubjectOverviewGrid";
import { SubjectFormDialog } from "./components/SubjectFormDialog";
import { SectionFormDialog } from "./components/SectionFormDialog";
import {
  fetchAcademicsOverview,
  fetchTeachers,
  fetchTeachersWithLoads,
} from "./api";
import type { AcademicsOverview, SubjectOverview, TeacherWithLoads } from "./api";
import type { Teacher } from "./data";
import { TeachersSection } from "./components/TeachersSection";
import styles from "./academics.module.css";

export default function RegistrarAcademicsPage() {
  const router = useRouter();
  const [overview, setOverview] = React.useState<AcademicsOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [subjectDialogOpen, setSubjectDialogOpen] = React.useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false);
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [teacherLoads, setTeacherLoads] = React.useState<TeacherWithLoads[]>([]);
  const [teachersLoading, setTeachersLoading] = React.useState(true);
  const [view, setView] = React.useState<"subjects" | "sections" | "teachers">("subjects");
  const [sectionGrade, setSectionGrade] = React.useState<11 | 12 | "all">("all");
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchAcademicsOverview()
      .then((res) => {
        if (!cancelled) setOverview(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status ? `Failed to load academics (HTTP ${status})` : "Failed to load academics.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchTeachersWithLoads()
      .then((res) => {
        if (!cancelled) setTeacherLoads(res);
      })
      .catch(() => {
        if (!cancelled) setTeacherLoads([]);
      })
      .finally(() => {
        if (!cancelled) setTeachersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAcademicsOverview()
      .then((res) => setOverview(res))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(
          status ? `Failed to load academics (HTTP ${status})` : "Failed to load academics.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const subjects = React.useMemo<SubjectOverview[]>(
    () => (Array.isArray(overview?.subjects) ? overview!.subjects : []),
    [overview],
  );

  // Sections view — derived from the subject enrollments already on the
  // page (no extra fetch). NOTE: the API repeats the same per-section
  // headcount on every subject of the grade, so the section population is
  // taken once per section (first occurrence) — summing would multiply
  // students by the subject count.
  const sectionCards = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        grades: number[];
        subjects: { code: string; name: string }[];
        students: number;
      }
    >();
    for (const s of subjects) {
      for (const e of s.enrollments) {
        const cur = map.get(e.id) ?? { id: e.id, name: e.name, grades: [], subjects: [], students: e.count };
        if (!cur.grades.includes(s.gradeLevel)) cur.grades.push(s.gradeLevel);
        if (!cur.subjects.some((sub) => sub.code === s.code)) {
          cur.subjects.push({ code: s.code, name: s.name });
        }
        map.set(e.id, cur);
      }
    }
    return [...map.values()]
      .map((sec) => ({
        ...sec,
        grades: sec.grades.sort((a, b) => a - b),
        subjects: sec.subjects.sort((a, b) => a.code.localeCompare(b.code)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects]);

  const visibleSections = React.useMemo(() => {
    if (sectionGrade === "all") return sectionCards;
    return sectionCards.filter((sec) => sec.grades.includes(sectionGrade));
  }, [sectionCards, sectionGrade]);

  const selectedSection = React.useMemo(
    () => sectionCards.find((sec) => sec.id === selectedSectionId) ?? null,
    [sectionCards, selectedSectionId],
  );

  const VIEWS = [
    { key: "subjects", label: "Subjects", sub: `${subjects.length} in catalog`, icon: BookOpen },
    { key: "sections", label: "Sections", sub: `${sectionCards.length} tracked`, icon: LayoutGrid },
    {
      key: "teachers",
      label: "Teachers",
      sub: teachersLoading ? "loading…" : `${teacherLoads.length} active`,
      icon: UserRound,
    },
  ] as const;

  const openSectionDialog = React.useCallback(async () => {
    setSectionDialogOpen(true);
    if (teachers.length === 0) {
      try {
        setTeachers(await fetchTeachers());
      } catch {
        setTeachers([]);
      }
    }
  }, [teachers.length]);

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Academics actions">
          <ConfigureSection
            orientation="vertical"
            onAddSubject={() => setSubjectDialogOpen(true)}
            onAddSection={() => void openSectionDialog()}
            onAssignSubjects={() => router.push("/registrar/academics/assign")}
          />

          <div className={styles.displayCard}>
            <h2 className={styles.displayTitle}>Display</h2>
            <p className={styles.displayDesc}>Choose what the panel shows.</p>
            <div className={styles.displayOptions} role="group" aria-label="Choose panel content">
              {VIEWS.map((v) => {
                const active = view === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={active}
                    className={`${styles.displayBtn} ${active ? styles.displayBtnActive : ""}`}
                    onClick={() => setView(v.key)}
                  >
                    <span className={styles.displayText}>
                      <span className={styles.displayLabel}>{v.label}</span>
                      <span className={styles.displaySub}>{v.sub}</span>
                    </span>
                    <v.icon className={styles.displayBannerIcon} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          {view === "subjects" ? (
            error ? (
              <div className={styles.error}>
                <span>{error}</span>
                <button type="button" className={styles.retry} onClick={load}>
                  <RefreshCw className={styles.retryIcon} />
                  Retry
                </button>
              </div>
            ) : subjects.length === 0 && !loading ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <LayoutGrid className={styles.emptyIconSvg} />
                </span>
                <p className={styles.emptyText}>No sections or subjects to show.</p>
              </div>
            ) : (
              <SubjectOverviewGrid
                schoolYear={overview?.schoolYear ?? null}
                term={overview?.term ?? null}
                subjects={subjects}
                loading={loading}
              />
            )
          ) : view === "sections" ? (
            error ? (
              <div className={styles.error}>
                <span>{error}</span>
                <button type="button" className={styles.retry} onClick={load}>
                  <RefreshCw className={styles.retryIcon} />
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <LayoutGrid className={styles.emptyIconSvg} />
                </span>
                <p className={styles.emptyText}>Loading sections…</p>
              </div>
            ) : visibleSections.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <LayoutGrid className={styles.emptyIconSvg} />
                </span>
                <p className={styles.emptyText}>
                  {sectionGrade === "all"
                    ? "No sections to show."
                    : `No sections for Grade ${sectionGrade}.`}
                </p>
              </div>
            ) : (
              <>
                <div className={styles.viewHead}>
                  <div className={styles.viewHeadText}>
                    <h2 className={styles.viewTitle}>Sections</h2>
                    <p className={styles.viewDesc}>
                      {visibleSections.length} section{visibleSections.length === 1 ? "" : "s"}
                      {sectionGrade === "all" ? "" : ` · Grade ${sectionGrade}`} — roster per section
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`${styles.filterBtn} ${
                          sectionGrade !== "all" ? styles.filterActive : ""
                        }`}
                      >
                        {sectionGrade === "all" ? "All grades" : `Grade ${sectionGrade}`}
                        {sectionGrade !== "all" && <span className={styles.filterDot} aria-hidden />}
                        <ChevronDown aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={styles.filterMenu}>
                      <DropdownMenuCheckboxItem
                        checked={sectionGrade === "all"}
                        onCheckedChange={() => setSectionGrade("all")}
                      >
                        All grades
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={sectionGrade === 11}
                        onCheckedChange={() => setSectionGrade(11)}
                      >
                        Grade 11
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={sectionGrade === 12}
                        onCheckedChange={() => setSectionGrade(12)}
                      >
                        Grade 12
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className={styles.sectionGrid}>
                  {visibleSections.map((sec) => (
                  <article
                    key={sec.id}
                    className={`${styles.sectionCard} ${styles.sectionCardClickable}`}
                    onClick={() => setSelectedSectionId(sec.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSectionId(sec.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View subjects of ${sec.name}`}
                  >
                    <header className={styles.sectionCardHead}>
                      <h3 className={styles.sectionCardTitle}>{sec.name}</h3>
                      <span className={styles.sectionCardTotal}>
                        {sec.students} student{sec.students === 1 ? "" : "s"}
                      </span>
                    </header>
                    <p className={styles.sectionCardMeta}>
                      {sec.subjects.length} subject{sec.subjects.length === 1 ? "" : "s"} offered
                    </p>
                    <LayoutGrid className={styles.sectionCardIcon} aria-hidden />
                  </article>
                ))}
                </div>
              </>
            )
          ) : (
            <TeachersSection teachers={teacherLoads} loading={teachersLoading} />
          )}
        </div>
      </div>

      <Dialog open={selectedSection !== null} onOpenChange={(open) => !open && setSelectedSectionId(null)}>
        <DialogContent className={styles.modalContent}>
          <DialogHeader>
            <p className={styles.modalEyebrow}>Section roster</p>
            <DialogTitle className={styles.modalTitle}>{selectedSection?.name ?? "Section"}</DialogTitle>
            <DialogDescription>
              Subjects offered in this section.
            </DialogDescription>
          </DialogHeader>
          {selectedSection && (
            <div className={styles.modalStats}>
              <div className={styles.modalStat}>
                <span className={styles.modalStatValue}>{selectedSection.subjects.length}</span>
                <span className={styles.modalStatLabel}>
                  Subject{selectedSection.subjects.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className={styles.modalStat}>
                <span className={styles.modalStatValue}>{selectedSection.students}</span>
                <span className={styles.modalStatLabel}>Students</span>
              </div>
            </div>
          )}
          <ul className={styles.modalSubjectList}>
            {selectedSection?.subjects.map((sub) => (
              <li key={sub.code} className={styles.modalSubjectRow}>
                <div className={styles.modalSubjectTop}>
                  <span className={styles.modalCodePill}>{sub.code}</span>
                  <span className={styles.modalSubjectName}>{sub.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <SubjectFormDialog
        open={subjectDialogOpen}
        subject={null}
        onOpenChange={setSubjectDialogOpen}
        onSave={() => {
          setSubjectDialogOpen(false);
          load();
        }}
      />
      <SectionFormDialog
        open={sectionDialogOpen}
        section={null}
        teachers={teachers}
        onOpenChange={setSectionDialogOpen}
        onSave={() => {
          setSectionDialogOpen(false);
          load();
        }}
      />
    </section>
  );
}
