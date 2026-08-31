import * as React from "react";
import { LayoutGrid, Search, Pencil, UserRound, BookMarked } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { type Assignment, type Section, type Subject, type Teacher } from "../data";
import { SectionFormDialog } from "./SectionFormDialog";
import { SectionAssignments } from "./SectionAssignments";
import styles from "./sections-panel.module.css";

type Props = {
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  loading: boolean;
  onUpsert: (section: Section) => void;
  onAssignmentsChange: (sectionId: string, assignments: Assignment[]) => void;
};

export function SectionsPanel({ sections, subjects, teachers, loading, onUpsert, onAssignmentsChange }: Props) {
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Section | null>(null);
  const [editKey, setEditKey] = React.useState("new");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const keySeq = React.useRef(0);

  const bumpKey = () => setEditKey(`k${++keySeq.current}`);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.name.toLowerCase().includes(q));
  }, [sections, query]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const openNew = () => {
    setEditing(null);
    bumpKey();
    setDialogOpen(true);
  };

  const openEdit = (section: Section) => {
    setEditing(section);
    bumpKey();
    setDialogOpen(true);
  };

  const adviserName = (s: Section) => s.adviserName || "Unassigned";

  return (
    <section className={styles.sections}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <span className={styles.headIcon}>
            <LayoutGrid className={styles.headIconSvg} />
          </span>
          <div>
            <h2 className={styles.title}>Sections</h2>
            <p className={styles.sub}>Grades 11–12 · {sections.length} sections</p>
          </div>
        </div>
        <div className={styles.controls}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.searchInput}
              placeholder="Search section"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button onClick={openNew}>
            New Section
          </Button>
        </div>
      </header>

      {loading ? (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelTile} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {sections.length === 0 ? "No sections configured yet." : "No sections match your search."}
        </p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className={styles.tile}
              onClick={() => setSelectedId(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(s.id);
                }
              }}
              aria-label={`Open ${s.name}`}
            >
              <div className={styles.tileHeader}>
                <div>
                  <h3 className={styles.tileName}>{s.name}</h3>
                  <span className={styles.tileGrade}>Grade {s.gradeLevel}</span>
                </div>
                <Button
                  size="xs"
                  className={styles.editButton}
                  aria-label="Edit section"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(s);
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className={styles.tileMeta}>
                <span className={styles.metaLine}>
                  <UserRound className={styles.metaIcon} />
                  {adviserName(s)}
                </span>
                <span className={styles.metaLine}>
                  <BookMarked className={styles.metaIcon} />
                  <span className={styles.metaMuted}>{s.schoolYear}</span>
                </span>
              </div>
              <div className={styles.tileFoot}>
                <span className={styles.count}>
                  <BookMarked className={styles.countIcon} />
                  {s.assignments.length} subjects
                </span>
                <span className={styles.openHint}>Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionFormDialog
        key={editKey}
        open={dialogOpen}
        section={editing}
        subjects={subjects}
        teachers={teachers}
        onOpenChange={setDialogOpen}
        onSave={onUpsert}
      />

      <Sheet open={selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  Grade {selected.gradeLevel} · {selected.schoolYear}
                </SheetDescription>
              </SheetHeader>
              <div className={styles.drawerBody}>
                <div className={styles.metaRow}>
                  <div className={styles.meta}>
                    <span className={styles.metaLabel}>Adviser</span>
                    <span className={styles.metaValue}>{adviserName(selected)}</span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.metaLabel}>School Year</span>
                    <span className={styles.metaValue}>{selected.schoolYear}</span>
                  </div>
                </div>
                <div className={styles.divider} />
                <SectionAssignments
                  section={selected}
                  subjects={subjects}
                  teachers={teachers}
                  sectionId={selected.id}
                  onChange={(assignments) => onAssignmentsChange(selected.id, assignments)}
                />
                <div className={styles.divider} />
                <Button variant="outline" onClick={() => openEdit(selected)}>
                  <Pencil />
                  Edit section details
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
