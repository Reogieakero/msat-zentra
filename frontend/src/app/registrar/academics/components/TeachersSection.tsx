import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, X, Eye, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className={styles.listHead}>
        <div className={styles.listHeadText}>
          <h2 className={styles.listTitle}>Teachers</h2>
          <p className={styles.listDesc}>
            Active teachers with their current subject loads for grades 11–12 —{" "}
            {loading ? "…" : `${filtered.length} shown`}.
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
              Show all
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Subjects</th>
                <th>Sections</th>
                <th>
                  <span className={styles.srOnly}>Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRows />
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyPanel}>
          <span className={styles.emptyIcon} aria-hidden>
            <UserRound />
          </span>
          <p className={styles.emptyTitle}>
            {query.trim() ? "No matching teachers" : "No teachers to show"}
          </p>
          <p className={styles.emptyHint}>
            {query.trim()
              ? `No teachers match "${query}".`
              : "No active teachers to show."}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Subjects</th>
                <th>Sections</th>
                <th>
                  <span className={styles.srOnly}>Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => {
                const subjectCount = t.loads.length;
                const sectionTotal = t.loads.reduce((s, l) => s + l.sections.length, 0);
                return (
                  <tr
                    key={t.id}
                    className={styles.tableRow}
                    onClick={() => router.push(`/registrar/academics/teachers/${t.id}`)}
                  >
                    <td>
                      <p className={styles.cellMain}>{t.name}</p>
                      <p className={styles.cellSub}>
                        {t.loads
                          .map((l) => l.code)
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .slice(0, 3)
                          .join(" · ") || "No load yet"}
                      </p>
                    </td>
                    <td className={styles.cell}>
                      {subjectCount === 0 ? "—" : subjectCount}
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
                          className={styles.menu}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            className={styles.menuItem}
                            onClick={() => router.push(`/registrar/academics/teachers/${t.id}`)}
                          >
                            <Eye aria-hidden />
                            View workload
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={styles.menuItem}
                            disabled={subjectCount === 0}
                          >
                            {subjectCount === 0 ? "No assignments yet" : `${subjectCount} subjects assigned`}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.footer}>
        <p className={styles.footerInfo}>
          Showing {filtered.length > 0 ? `${start}–${end}` : "0"} of {filtered.length}
        </p>
        <div className={styles.footerActions}>
          <Button
            size="xs"
            variant="outline"
            disabled={safePage <= 1 || filtered.length === 0}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className={styles.pageLabel} aria-live="polite">
            Page {safePage} of {totalPages}
          </span>
          <Button
            size="xs"
            variant="outline"
            disabled={safePage >= totalPages || filtered.length === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
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
            <div className={styles.skelLines}>
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
