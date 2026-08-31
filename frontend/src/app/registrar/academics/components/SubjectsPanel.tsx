import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { GradeLevel, Subject } from "../data";
import { SubjectFormDialog } from "./SubjectFormDialog";
import { SubjectDonut } from "./SubjectDonut";
import styles from "./subjects-panel.module.css";

type Props = {
  subjects: Subject[];
  loading: boolean;
  onUpsert: (subject: Subject) => void;
};

export function SubjectsPanel({ subjects, loading, onUpsert }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Subject | null>(null);
  const [editKey, setEditKey] = React.useState("new");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => `${s.code} ${s.name}`.toLowerCase().includes(q));
  }, [subjects, query]);

  const openNew = () => {
    setEditing(null);
    setEditKey("new");
    setDialogOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setEditKey(subject.id);
    setDialogOpen(true);
  };

  const openSubject = (subject: Subject) => {
    router.push(`/registrar/academics/subjects/${subject.id}`);
  };

  return (
    <section className={styles.subjects}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <span className={styles.headIcon}>
            <BookOpen className={styles.headIconSvg} />
          </span>
          <div>
            <h2 className={styles.title}>Subject Catalog</h2>
            <p className={styles.sub}>Grades 11–12 · {subjects.length} subjects</p>
          </div>
        </div>
        <div className={styles.controls}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.searchInput}
              placeholder="Search code or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button onClick={openNew}>
            New Subject
          </Button>
        </div>
      </header>

      {loading ? (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelTile} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {subjects.length === 0 ? "No subjects configured yet." : "No subjects match your search."}
        </p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => (
            <article
              key={s.id}
              className={`${styles.tile} ${s.active ? "" : styles.inactive}`}
              tabIndex={0}
              role="button"
              aria-label={`View students for ${s.name}`}
              onClick={() => openSubject(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openSubject(s);
                }
              }}
            >
              <div className={styles.tileBody}>
                <div className={styles.tileTop}>
                  <span className={styles.tileCode}>{s.code}</span>
                  <Button
                    size="xs"
                    className={styles.editButton}
                    aria-label="Edit subject"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(s);
                    }}
                  >
                    Edit
                  </Button>
                </div>
                <h3 className={styles.tileName}>{s.name}</h3>
                <div className={styles.tileFoot}>
                  <span className={styles.gradeTag}>Grade {s.gradeLevel as GradeLevel}</span>
                  {s.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <span className={styles.enrolled}>
                  <b>{s.enrolled}</b> enrolled
                </span>
              </div>
              <div className={styles.tileSide}>
                <SubjectDonut passed={s.passed} failed={s.failed} />
                <div className={styles.legend}>
                  <span className={styles.legendRow}>
                    <span className={`${styles.dot} ${styles.dotPass}`} />
                    Passed {s.passed}
                  </span>
                  <span className={styles.legendRow}>
                    <span className={`${styles.dot} ${styles.dotFail}`} />
                    Failed {s.failed}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <SubjectFormDialog
        key={editKey}
        open={dialogOpen}
        subject={editing}
        onOpenChange={setDialogOpen}
        onSave={onUpsert}
      />
    </section>
  );
}
