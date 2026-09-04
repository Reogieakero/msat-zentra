"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdvisoryStudentsHeader } from "./components/AdvisoryStudentsHeader";
import { StudentTable } from "./components/StudentTable";
import { AddStudentDialog } from "./components/AddStudentDialog";
import { fetchAdvisoryRoster } from "./components/advisory-students-data";
import styles from "./components/advisory-students.module.css";

export default function TeacherAdvisoryStudentsPage() {
  const [addOpen, setAddOpen] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ["advisory-students"],
    queryFn: fetchAdvisoryRoster,
    retry: false,
  });
  const students = rosterQuery.data?.students ?? [];
  const sectionName = rosterQuery.data?.advisorySections[0]?.name ?? "";

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
          <StudentTable students={students} loading={rosterQuery.isPending} />
        )}
      </div>

      <AddStudentDialog
        open={addOpen}
        sectionName={sectionName}
        onOpenChange={setAddOpen}
      />
    </section>
  );
}
