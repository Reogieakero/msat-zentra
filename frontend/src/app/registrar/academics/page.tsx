"use client";

import * as React from "react";
import { BookOpen, LayoutGrid } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SubjectsPanel } from "./components/SubjectsPanel";
import { SectionsPanel } from "./components/SectionsPanel";
import { fetchSections, fetchSubjects, fetchTeachers } from "./api";
import type { Assignment, Section, Subject, Teacher } from "./data";
import styles from "./academics.module.css";
import tab from "./tabs.module.css";

export default function RegistrarAcademicsPage() {
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const [subj, secs, teach] = await Promise.all([
        fetchSubjects(signal),
        fetchSections(signal),
        fetchTeachers(signal),
      ]);
      setSubjects(subj);
      setSections(secs);
      setTeachers(teach);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status ? `Failed to load academics (HTTP ${status})` : "Failed to load academics");
      console.error("[/api/registrar/academics] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch populates state
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleSubjectUpsert = React.useCallback((subject: Subject) => {
    setSubjects((prev) => {
      const idx = prev.findIndex((s) => s.id === subject.id);
      if (idx === -1) return [...prev, subject];
      const next = [...prev];
      next[idx] = subject;
      return next;
    });
  }, []);

  const handleSectionUpsert = React.useCallback((section: Section) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === section.id);
      if (idx === -1) return [...prev, section];
      const next = [...prev];
      next[idx] = section;
      return next;
    });
  }, []);

  const handleAssignmentsChange = React.useCallback(
    (sectionId: string, assignments: Assignment[]) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, assignments } : s)),
      );
    },
    [],
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Sections &amp; Subjects</h1>
          <p className={styles.subtitle}>
            Academic catalog for grades 11–12. Configure subjects and class sections,
            then assign teachers per term.
          </p>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <Tabs defaultValue="subjects" className={tab.tabs}>
        <TabsList variant="line" className={tab.list}>
          <TabsTrigger value="subjects" className={tab.trigger}>
            <BookOpen className={tab.icon} />
            Subjects
          </TabsTrigger>
          <TabsTrigger value="sections" className={tab.trigger}>
            <LayoutGrid className={tab.icon} />
            Sections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className={tab.content}>
          <SubjectsPanel subjects={subjects} loading={loading} onUpsert={handleSubjectUpsert} />
        </TabsContent>
        <TabsContent value="sections" className={tab.content}>
          <SectionsPanel
            sections={sections}
            subjects={subjects}
            teachers={teachers}
            loading={loading}
            onUpsert={handleSectionUpsert}
            onAssignmentsChange={handleAssignmentsChange}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
