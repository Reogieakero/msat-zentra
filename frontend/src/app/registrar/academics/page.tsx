"use client";

import * as React from "react";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { AcademicsHeader } from "./components/AcademicsHeader";
import { ConfigureSection } from "./components/ConfigureSection";
import { SubjectOverviewGrid } from "./components/SubjectOverviewGrid";
import { SubjectFormDialog } from "./components/SubjectFormDialog";
import { SectionFormDialog } from "./components/SectionFormDialog";
import { fetchAcademicsOverview, fetchTeachers } from "./api";
import type { AcademicsOverview } from "./api";
import type { Subject, Teacher } from "./data";
import styles from "./academics.module.css";

function toSubjectShape(s: { id: string; code: string; name: string; gradeLevel: number; active: boolean; enrolled: number }): Subject {
  return { id: s.id, code: s.code, name: s.name, gradeLevel: s.gradeLevel as 11 | 12, active: s.active, enrolled: s.enrolled, passed: 0, failed: 0 };
}

export default function RegistrarAcademicsPage() {
  const [overview, setOverview] = React.useState<AcademicsOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [subjectDialogOpen, setSubjectDialogOpen] = React.useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false);
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);

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
      <AcademicsHeader />

      <ConfigureSection
        onAddSubject={() => setSubjectDialogOpen(true)}
        onAddSection={() => void openSectionDialog()}
      />

      {error ? (
        <div className={styles.error}>
          <span>{error}</span>
          <button type="button" className={styles.retry} onClick={load}>
            <RefreshCw className={styles.retryIcon} />
            Retry
          </button>
        </div>
      ) : overview && overview.subjects.length === 0 && !loading ? (
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
          subjects={overview?.subjects ?? []}
          loading={loading}
        />
      )}

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
        subjects={(overview?.subjects ?? []).map(toSubjectShape)}
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
