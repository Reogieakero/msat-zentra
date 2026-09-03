import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { TeacherWithLoads } from "../api";
import styles from "./teachers-section.module.css";

type Props = {
  teachers: TeacherWithLoads[];
  loading: boolean;
};

const PAGE_SIZE = 10;

export function TeachersSection({ teachers, loading }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const subjectMatch = t.loads.some(
        (l) =>
          l.code.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          l.sections.some((s) => s.toLowerCase().includes(q)),
      );
      return nameMatch || subjectMatch;
    });
  }, [teachers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <section className={styles.section} aria-label="Teachers">
      <div className={styles.listCard}>
        <div className={styles.listHead}>
          <div className={styles.listHeadText}>
            <h2 className={styles.listTitle}>Teachers</h2>
            <p className={styles.listDesc}>
              Active teachers with their current subject loads for grades 7–10.
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                placeholder="Search teacher or subject…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search teachers"
              />
            </div>

            {query && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearBtn}
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Subjects</th>
              <th>Sections</th>
              <th className={styles.thAction} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  {loading
                    ? "Loading…"
                    : query.trim()
                      ? `No teachers match "${query}".`
                      : "No active teachers to show."}
                </td>
              </tr>
            ) : (
              pageRows.map((t) => {
                const subjectCount = t.loads.length;
                const sectionTotal = t.loads.reduce((s, l) => s + l.sections.length, 0);
                return (
                  <tr
                    key={t.id}
                    className={styles.tableRow}
                    onClick={() => router.push(`/record-keeper/academics/teachers/${t.id}`)}
                  >
                    <td>
                      <div className={styles.studentCell}>
                        <span className={styles.studentName}>{t.name}</span>
                        <span className={styles.studentLrn}>
                          {t.loads
                            .map((l) => l.code)
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .slice(0, 3)
                            .join(" · ") || "No load yet"}
                        </span>
                      </div>
                    </td>
                    <td className={styles.cell}>
                      {subjectCount === 0 ? "—" : <Badge variant="outline">{subjectCount}</Badge>}
                    </td>
                    <td className={styles.cell}>
                      {sectionTotal === 0 ? "—" : `${sectionTotal} section${sectionTotal === 1 ? "" : "s"}`}
                    </td>
                    <td className={styles.actionCell}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={() => router.push(`/record-keeper/academics/teachers/${t.id}`)}
                          >
                            <Eye aria-hidden />
                            View workload
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={subjectCount === 0}
                          >
                            {subjectCount === 0 ? "No assignments yet" : `${subjectCount} subjects assigned`}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className={styles.footer}>
          <span className={styles.footerInfo}>
            {loading ? "Loading…" : `${start}–${end} of ${filtered.length}`}
          </span>
          <div className={styles.footerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1 || filtered.length === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages || filtered.length === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td>
            <div className={styles.studentCell}>
              <Skeleton className={styles.skelName} />
              <Skeleton className={styles.skelCell} style={{ width: "45%", marginTop: "0.25rem" }} />
            </div>
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "40%" }} />
          </td>
          <td>
            <Skeleton className={styles.skelCell} style={{ width: "40%" }} />
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}
