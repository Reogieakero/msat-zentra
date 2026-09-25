"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdvisorySidebar } from "./components/AdvisorySidebar";
import { StudentTable } from "./components/StudentTable";
import { SubjectStudents } from "./components/SubjectStudents";
import { AddStudentDialog } from "./components/AddStudentDialog";
import { fetchAdvisoryRoster } from "./components/advisory-students-data";
import { useTeacherOverview } from "../../overview/components/teacher-overview-data";
import styles from "./components/advisory-students.module.css";

export default function TeacherAdvisoryStudentsPage() {
  const [addOpen, setAddOpen] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ["advisory-students"],
    queryFn: fetchAdvisoryRoster,
    retry: false,
  });
  const overviewQuery = useTeacherOverview();
  const students = rosterQuery.data?.students ?? [];
  const sections = rosterQuery.data?.advisorySections ?? [];
  const classes = overviewQuery.data?.classes ?? [];
  const sectionName = sections[0]?.name ?? "";

  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const subjectTargets =
    activeSubject == null
      ? []
      : classes
          .filter((c) => c.subject === activeSubject)
          .map((c) => ({ id: c.id, section: c.section }));

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <AdvisorySidebar
          sections={sections}
          classes={classes}
          loading={rosterQuery.isPending}
          subjectsLoading={overviewQuery.isPending}
          activeSubject={activeSubject}
          onSelectSubject={(subject) =>
            setActiveSubject((prev) => (prev === subject ? null : subject))
          }
          onAdd={() => setAddOpen(true)}
        />

        <div className={styles.main}>
          {activeSubject != null ? (
            <SubjectStudents subject={activeSubject} targets={subjectTargets} />
          ) : rosterQuery.isError ? (
            <p className={styles.pageError}>
              No advisory section assigned, or it could not be loaded. Contact the school
              office.
            </p>
          ) : (
            <StudentTable students={students} loading={rosterQuery.isPending} />
          )}
        </div>
      </div>

      <AddStudentDialog
        open={addOpen}
        sectionName={sectionName}
        onOpenChange={setAddOpen}
      />
    </section>
  );
}
