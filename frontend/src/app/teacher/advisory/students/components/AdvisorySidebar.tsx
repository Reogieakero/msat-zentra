"use client";

import * as React from "react";
import { GraduationCap, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeacherClassRow } from "../../../overview/components/teacher-overview-data";
import type { AdvisorySectionInfo } from "./advisory-students-data";
import styles from "./AdvisorySidebar.module.css";

interface AdvisorySidebarProps {
  sections: AdvisorySectionInfo[];
  classes: TeacherClassRow[];
  loading: boolean;
  subjectsLoading: boolean;
  activeSubject: string | null;
  onSelectSubject: (subject: string) => void;
  onAdd: () => void;
}

export function AdvisorySidebar({ sections, classes, loading, subjectsLoading, activeSubject, onSelectSubject, onAdd }: AdvisorySidebarProps) {
  const subjects = React.useMemo(() => {
    const grouped = new Map<string, { sections: string[]; students: number }>();
    for (const c of classes) {
      const entry = grouped.get(c.subject) ?? { sections: [], students: 0 };
      if (!entry.sections.includes(c.section)) entry.sections.push(c.section);
      entry.students += c.studentCount;
      grouped.set(c.subject, entry);
    }
    return [...grouped.entries()];
  }, [classes]);

  const [subjectQuery, setSubjectQuery] = React.useState("");
  const filteredSubjects = React.useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (q === "") return subjects;
    return subjects.filter(
      ([subject, info]) =>
        subject.toLowerCase().includes(q) ||
        info.sections.some((s) => s.toLowerCase().includes(q))
    );
  }, [subjects, subjectQuery]);

  return (
    <aside className={styles.sidebar} aria-label="Advisory summary">
      {loading ? (
        <article className={styles.bannerCard} aria-busy="true" aria-label="Loading advisory">
          <div className={styles.bannerText}>
            <Skeleton className={styles.skelEyebrow} />
            <Skeleton className={styles.skelName} />
            <Skeleton className={styles.skelSub} />
          </div>
        </article>
      ) : sections.length === 0 ? (
        <article className={styles.card}>
          <div className={styles.heading}>
            <GraduationCap className={styles.icon} aria-hidden />
            <h2 className={styles.title}>My Advisory</h2>
          </div>
          <p className={styles.body}>No advisory section assigned.</p>
          <Button
            variant="outline"
            className={styles.bannerAddBtn}
            onClick={onAdd}
          >
            Add student
          </Button>
        </article>
      ) : (
        sections.map((s) => (
          <article key={s.id} className={styles.bannerCard}>
            <div className={styles.bannerText}>
              <span className={styles.bannerEyebrow}>My Advisory</span>
              <h2 className={styles.bannerName}>{s.name}</h2>
              <span className={styles.bannerSub}>Grade {s.gradeLevel}</span>
            </div>
            <Button
              variant="secondary"
              className={`${styles.bannerAddBtn} ${styles.bannerAddBtnOnBanner}`}
              onClick={onAdd}
            >
              Add student
            </Button>
          </article>
        ))
      )}

      <article className={styles.subjectsCard}>
        <div className={styles.subjectsBanner}>
          <div className={styles.subjectsBannerHead}>
            <h2 className={styles.bannerTitle}>Subjects Handled</h2>
            <span className={styles.bannerCount}>{subjects.length}</span>
          </div>
          <div className={styles.bannerSearchWrap}>
            <Search className={styles.bannerSearchIcon} aria-hidden />
            <input
              className={styles.bannerSearch}
              placeholder="Search subjects…"
              aria-label="Search subjects"
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.subjectsBody}>
          {subjectsLoading ? (
            <ul className={`${styles.list} ${styles.subjectList}`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className={styles.nestedCard} aria-hidden>
                  <Skeleton className={styles.skelRowTitle} />
                  <Skeleton className={styles.skelRowMeta} />
                </li>
              ))}
            </ul>
          ) : subjects.length === 0 ? (
            <p className={styles.body}>No subjects assigned yet.</p>
          ) : filteredSubjects.length === 0 ? (
            <p className={styles.body}>No subjects match &ldquo;{subjectQuery}&rdquo;.</p>
          ) : (
            <ul className={`${styles.list} ${styles.subjectList}`}>
              {filteredSubjects.map(([subject, info]) => (
                <li key={subject}>
                  <button
                    type="button"
                    className={`${styles.nestedCard} ${activeSubject === subject ? styles.nestedCardActive : ""}`}
                    onClick={() => onSelectSubject(subject)}
                    aria-current={activeSubject === subject ? "true" : undefined}
                  >
                    <span className={styles.nestedText}>
                      <span className={styles.nestedLine}>
                        <span className={styles.nestedLabel}>Subject</span>
                        <span className={styles.nestedValue}>{subject}</span>
                      </span>
                      <span className={styles.nestedLine}>
                        <span className={styles.nestedLabel}>Section</span>
                        <span className={styles.nestedValue}>{info.sections.join(", ")}</span>
                      </span>
                    </span>
                    <ChevronRight className={styles.nestedChevron} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </aside>
  );
}
