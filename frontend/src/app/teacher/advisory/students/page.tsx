"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdvisoryStudentsHeader } from "./components/AdvisoryStudentsHeader";
import { StudentTable } from "./components/StudentTable";
import { StudentDrawer } from "./components/StudentDrawer";
import { AddStudentDialog } from "./components/AddStudentDialog";
import {
  fetchAdvisoryRoster,
  type DrawerSection,
} from "./components/advisory-students-data";
import styles from "./components/advisory-students.module.css";

export default function TeacherAdvisoryStudentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<DrawerSection | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ["advisory-students"],
    queryFn: fetchAdvisoryRoster,
    retry: false,
  });
  const students = rosterQuery.data?.students ?? [];
  const sectionName = rosterQuery.data?.advisorySections[0]?.name ?? "";
  const rosterRow = students.find((s) => s.studentId === selectedId) ?? null;

  return (
    <section className={styles.page}>
      <AdvisoryStudentsHeader students={students} onAdd={() => setAddOpen(true)} />
      <hr className={styles.divider} />

      <div className={styles.body}>
        {rosterQuery.isError ? (
          <p className={styles.pageError}>
            No advisory section assigned, or it could not be loaded. Contact the school
            office.
          </p>
        ) : (
          <StudentTable
            students={students}
            loading={rosterQuery.isPending}
            onSelect={(studentId, section) => {
              setSelectedId(studentId);
              setFocus(section);
            }}
          />
        )}
      </div>

      <StudentDrawer
        studentId={selectedId}
        rosterRow={rosterRow}
        focus={focus}
        onClose={() => {
          setSelectedId(null);
          setFocus(null);
        }}
      />
      <AddStudentDialog
        open={addOpen}
        sectionName={sectionName}
        onOpenChange={setAddOpen}
      />
    </section>
  );
}
