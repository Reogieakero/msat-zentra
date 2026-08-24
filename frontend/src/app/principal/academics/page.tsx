"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { AcademicsKpis, type KpiFocus } from "./components/AcademicsKpis";
import { SectionSummaryTable } from "./components/SectionSummaryTable";
import { HonorRollTable } from "./components/HonorRollTable";
import { SectionStudentsPanel } from "./components/SectionStudentsPanel";
import { StudentSubjectBars } from "./components/StudentSubjectBars";
import { AverageGradeByLevel } from "./components/AverageGradeByLevel";
import { GradeBreakdownDrawer } from "./components/GradeBreakdownDrawer";
import { MOCK, subjectColumns, type StudentRow, type AcademicsMock } from "./mockData";
import { apiClient } from "@/lib/api/client";
import { Users as UsersIcon, X } from "lucide-react";
import styles from "./academics.module.css";

export default function PrincipalAcademicsPage() {
  const [selectedStudent, setSelectedStudent] = React.useState<StudentRow | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [data, setData] = React.useState<AcademicsMock | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hoveredStudent, setHoveredStudent] = React.useState<StudentRow | null>(null);
  const [focusMode, setFocusMode] = React.useState<KpiFocus | null>(null);
  const [gradeCardOpen, setGradeCardOpen] = React.useState(true);

  const handleSelectKpi = (key: KpiFocus) => {
    setFocusMode((prev) => (prev === key ? null : key));
  };

  const EMPTY: AcademicsMock = {
    termLabel: "",
    sections: [],
    passFailByGrade: [],
    honorRollPreview: [],
    potentialHonorRoll: [],
  };

  const loading = !data && !error;
  const source = loading ? EMPTY : data ?? MOCK;

  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(
    MOCK.sections[0]?.sectionId ?? null
  );
  const [gradeTab, setGradeTab] = React.useState<string>(
    MOCK.sections[0]?.grade ?? ""
  );

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AcademicsMock>("/api/academics")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load academics (HTTP ${status})`
              : "Failed to load academics"
          );
          console.error("[/api/academics] fetch failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectStudent = (student: StudentRow) => {
    setSelectedStudent(student);
    setDrawerOpen(true);
  };

  const hasFinals = (data ?? MOCK).sections.length > 0;

  const selectedSection =
    source.sections.find((s) => s.sectionId === selectedSectionId) ?? null;

  // Reopen the floating Average Grade card whenever the selection changes.
  React.useEffect(() => {
    setGradeCardOpen(true);
  }, [selectedSectionId]);

  const gradeTabs = React.useMemo(
    () =>
      Array.from(new Set(source.sections.map((s) => s.grade))).sort(
        (a, b) =>
          Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
      ),
    [source]
  );

  const sectionsForGrade = React.useMemo(
    () => source.sections.filter((s) => s.grade === gradeTab),
    [source, gradeTab]
  );

  // Derive subject columns from the selected section's students (backend
  // Subject.name values), so the student card only shows that section's subjects.
  // Falls back to the static list when no section is selected yet.
  const subjectList = React.useMemo(() => {
    const set = new Set<string>();
    const base = selectedSection ?? source.sections[0];
    for (const st of base?.students ?? []) {
      for (const sub of st.subjects) set.add(sub.subject);
    }
    const derived = Array.from(set);
    return derived.length > 0 ? derived : subjectColumns;
  }, [selectedSection, source]);

  return (
    <section className={styles.page}>
      <div className={styles.bannerRow}>
        <Card className={`${styles.bannerCardBox} ${styles.bannerCardMain}`}>
          <div
            className={styles.bannerImage}
            style={{
              backgroundImage:
                "linear-gradient(135deg, color-mix(in oklch, #0b0c0e, transparent 12%), color-mix(in oklch, #0b0c0e, transparent 38%)), url(https://images.unsplash.com/photo-1524177094446-987ecd1b41a1?auto=format&fit=crop&w=1600&q=80)",
            }}
          />
          <div className={styles.bannerCard}>
            <span className={styles.bannerBadge}>School-wide</span>
            <h3 className={styles.title}>Academic Performance</h3>
            <p className={styles.subtitle}>
              School-wide summary · {source.termLabel}
            </p>
          </div>
        </Card>

        <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
          <div
            className={styles.bannerImage}
            style={{
              backgroundImage:
                "linear-gradient(135deg, color-mix(in oklch, #7f1d1d, transparent 12%), color-mix(in oklch, #7f1d1d, transparent 38%)), url(https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1600&q=80)",
            }}
          />
          <div className={styles.bannerCard}>
            <span className={styles.bannerBadge}>Attention</span>
            <h3 className={styles.title}>Students at Risk</h3>
            <p className={styles.subtitle}>
              Learners below passing threshold
            </p>
          </div>
        </Card>

        <Card className={`${styles.bannerCardBox} ${styles.bannerCardSquare}`}>
          <div
            className={styles.bannerImage}
            style={{
              backgroundImage:
                "linear-gradient(135deg, color-mix(in oklch, #1e3a8a, transparent 12%), color-mix(in oklch, #1e3a8a, transparent 38%)), url(https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=80)",
            }}
          />
          <div className={styles.bannerCard}>
            <span className={styles.bannerBadge}>Records</span>
            <h3 className={styles.title}>ADM Students</h3>
            <p className={styles.subtitle}>
              Enrollment &amp; documentation status
            </p>
          </div>
        </Card>
      </div>

      {hoveredStudent && (
        <div className={styles.floatingGraph}>
          <StudentSubjectBars student={hoveredStudent} />
        </div>
      )}

      <AcademicsKpis
        sections={source.sections}
        honorRollPreview={source.honorRollPreview}
        potentialHonorRoll={source.potentialHonorRoll}
        loading={loading}
        focus={focusMode}
        onSelectKpi={handleSelectKpi}
      />

      {!loading && !hasFinals ? (
        <Card>
          <CardContent>
            <p className={styles.empty}>No finalized grades for this term.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={styles.splitRow}
            data-focus={focusMode ? "on" : "off"}
          >
            <Card className={styles.narrowCard}>
              <CardContent>
                <div className={styles.tabs} role="tablist" aria-label="Grade level">
                  {gradeTabs.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="tab"
                      aria-selected={gradeTab === g}
                      className={
                        gradeTab === g ? `${styles.tab} ${styles.tabActive}` : styles.tab
                      }
                      onClick={() => {
                        setGradeTab(g);
                        const first = source.sections.find((s) => s.grade === g);
                        setSelectedSectionId(first?.sectionId ?? null);
                      }}
                    >
                      {g.replace("Grade ", "G")}
                    </button>
                  ))}
                </div>
                <div className={styles.tabPanel}>
                  <SectionSummaryTable
                    sections={sectionsForGrade}
                    loading={loading}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={styles.detailCard}>
              {!focusMode && (
                <CardHeader>
                  <CardTitle>Students</CardTitle>
                  <CardDescription>
                    {selectedSection
                      ? `${selectedSection.section} · ${selectedSection.grade}`
                      : "All students in the selected section"}
                  </CardDescription>
                  <CardAction>
                    <ul className={styles.legend}>
                      <li className={styles.legendItem}>
                        <span className={`${styles.dot} ${styles.dotPass}`} /> &gt;80% partial
                      </li>
                      <li className={styles.legendItem}>
                        <span className={`${styles.dot} ${styles.dotPartial}`} /> ≥75% partial
                      </li>
                      <li className={styles.legendItem}>
                        <span className={`${styles.dot} ${styles.dotFail}`} /> &lt;75% partial
                      </li>
                    </ul>
                  </CardAction>
                </CardHeader>
              )}
              <CardContent>
                {focusMode ? (
                  <HonorRollTable
                    key={focusMode}
                    title={focusMode === "potential" ? "Potential Honor Roll" : "Honor Roll"}
                    candidates={
                      focusMode === "potential"
                        ? source.potentialHonorRoll
                        : source.honorRollPreview
                    }
                    showUnlocked={focusMode === "potential"}
                    loading={loading}
                    onClose={() => setFocusMode(null)}
                  />
                ) : selectedSection ? (
                  <SectionStudentsPanel
                    section={selectedSection}
                    subjects={subjectList}
                    onSelectStudent={handleSelectStudent}
                    onHoverStudent={setHoveredStudent}
                    loading={loading}
                  />
                ) : (
                  <div className={styles.placeholder}>
                    <UsersIcon className={styles.placeholderIcon} aria-hidden />
                    <p className={styles.placeholderText}>
                      Select a section from the left to view its students
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedSection && gradeCardOpen && (
            <Card className={styles.floatingGradeCard}>
              <CardHeader>
                <CardTitle>Average Grade per Level</CardTitle>
                <CardDescription>
                  Mean transmuted grade by subject
                </CardDescription>
                <CardAction>
                  <button
                    type="button"
                    className={styles.floatingClose}
                    onClick={() => setGradeCardOpen(false)}
                    aria-label="Close"
                  >
                    <X className={styles.floatingCloseIcon} aria-hidden />
                  </button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <AverageGradeByLevel
                  sections={source.sections}
                  subjects={subjectList}
                  activeGrade={gradeTab}
                  activeSectionId={selectedSectionId}
                  loading={loading}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <GradeBreakdownDrawer
        student={selectedStudent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </section>
  );
}
