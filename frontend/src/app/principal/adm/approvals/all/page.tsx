"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChevronDown, FileText, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import header from "../../../adm/components/AdmHeader.module.css";
import { fetchAdmApprovals, type AdmApprovalRow } from "../../../adm/api";
import styles from "./all.module.css";

const GRADE_COLORS: Record<string, string> = {
  "Grade 7": "#14532d",
  "Grade 8": "#166534",
  "Grade 9": "#15803d",
  "Grade 10": "#16a34a",
  "Grade 11": "#22c55e",
  "Grade 12": "#4ade80",
};

const GRADE_FALLBACK_PALETTE = [
  "#14532d",
  "#166534",
  "#15803d",
  "#16a34a",
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#bbf7d0",
];

export default function PrincipalAdmApprovalsAllPage() {
  const [rows, setRows] = React.useState<AdmApprovalRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [gradeFilter, setGradeFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const controller = new AbortController();
    fetchAdmApprovals(1, 1000, controller.signal)
      .then((data) => {
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotal(typeof data.total === "number" ? data.total : data.rows.length);
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        console.error("[/api/adm/approvals] fetch failed:", err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const gradeBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = r.grade || "Unspecified";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => {
      const ga = parseInt(a[0].replace(/\D/g, ""), 10) || 0;
      const gb = parseInt(b[0].replace(/\D/g, ""), 10) || 0;
      if (ga !== gb) return ga - gb;
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([grade, count], i) => ({
      grade,
      count,
      color:
        GRADE_COLORS[grade] ?? GRADE_FALLBACK_PALETTE[i % GRADE_FALLBACK_PALETTE.length],
    }));
  }, [rows]);

  const gradeTotal = total;

  const availableGrades = React.useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.grade).filter(Boolean))).sort(
        (a, b) => {
          const ga = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const gb = parseInt(b.replace(/\D/g, ""), 10) || 0;
          if (ga !== gb) return ga - gb;
          return a.localeCompare(b);
        }
      ),
    [rows]
  );

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesGrade = gradeFilter === "all" || r.grade === gradeFilter;
      const matchesSearch =
        !q ||
        r.student.toLowerCase().includes(q) ||
        r.lrn.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      return matchesGrade && matchesSearch;
    });
  }, [rows, gradeFilter, search]);

  const eligibilityBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {
      eligible: 0,
      pending: 0,
      ineligible: 0,
    };
    for (const r of rows) {
      const key = (r.eligibilityStatus as string) || "pending";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const topGrade = React.useMemo(() => {
    if (gradeBreakdown.length === 0) return null;
    return [...gradeBreakdown].sort((a, b) => b.count - a.count)[0];
  }, [gradeBreakdown]);

  const leastGrade = React.useMemo(() => {
    if (gradeBreakdown.length < 2) return null;
    return [...gradeBreakdown].sort((a, b) => a.count - b.count)[0];
  }, [gradeBreakdown]);

  const pendingShare =
    gradeTotal === 0
      ? 0
      : Math.round((eligibilityBreakdown.pending / gradeTotal) * 100);
  const eligibleShare =
    gradeTotal === 0
      ? 0
      : Math.round((eligibilityBreakdown.eligible / gradeTotal) * 100);
  const ineligibleShare =
    gradeTotal === 0
      ? 0
      : Math.round((eligibilityBreakdown.ineligible / gradeTotal) * 100);

  const insightItems = React.useMemo(() => {
    if (loading) {
      return [
        "Pulling the latest approval records…",
        "Eligibility status and grade distribution will update shortly.",
      ];
    }
    if (gradeTotal === 0) {
      return [
        "No ADM approvals on record yet — the queue populates after a profile is signed.",
        "Eligible, pending, and ineligible counts will surface once data is available.",
      ];
    }
    const items: string[] = [
      `${gradeTotal} total approval${gradeTotal === 1 ? "" : "s"} on record across ${
        gradeBreakdown.length
      } grade level${gradeBreakdown.length === 1 ? "" : "s"}.`,
      `${eligibilityBreakdown.eligible} eligible (${eligibleShare}%), ${eligibilityBreakdown.pending} pending (${pendingShare}%), ${eligibilityBreakdown.ineligible} ineligible (${ineligibleShare}%).`,
    ];
    if (topGrade) {
      const pct = Math.round((topGrade.count / gradeTotal) * 100);
      items.push(
        `${topGrade.grade} leads with ${topGrade.count} case${
          topGrade.count === 1 ? "" : "s"
        } — ${pct}% of all approvals.`
      );
    }
    if (leastGrade && topGrade && leastGrade.grade !== topGrade.grade) {
      items.push(
        `${leastGrade.grade} has the lightest coverage at ${leastGrade.count} case${
          leastGrade.count === 1 ? "" : "s"
        } — verify support capacity before the next term.`
      );
    }
    if (eligibilityBreakdown.pending > 0) {
      items.push(
        `${eligibilityBreakdown.pending} profile${
          eligibilityBreakdown.pending === 1 ? " is" : "s are"
        } still pending eligibility — review the eligibility queue before signing.`
      );
    }
    if (eligibilityBreakdown.ineligible > 0) {
      items.push(
        `${eligibilityBreakdown.ineligible} signed profile${
          eligibilityBreakdown.ineligible === 1 ? "" : "s"
        } flagged ineligible — escalate to the ADM Coordinator for follow-up.`
      );
    }
    return items;
  }, [
    loading,
    gradeTotal,
    gradeBreakdown.length,
    eligibilityBreakdown,
    eligibleShare,
    pendingShare,
    ineligibleShare,
    topGrade,
    leastGrade,
  ]);

  return (
    <section className={styles.page}>
      <div className={header.hero}>
        <h1 className={header.heroTitle}>ADM Cases – Approvals</h1>
        <p className={header.heroSubtitle}>
          Cases awaiting your final signature — review, sign, and authorize ADM
          module release.
        </p>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <h2 className={styles.chartTitle}>Approvals by Grade Level</h2>
            <p className={styles.chartSubtitle}>
              Distribution of signed ADM profiles across grade levels.
            </p>
          </div>
          <div>
            <span className={styles.donutTotal}>{loading ? "—" : gradeTotal}</span>{" "}
            <span className={styles.donutUnit}>cases</span>
          </div>
        </div>

        <div className={styles.chartBody}>
          <div className={styles.chartSide}>
            <div className={styles.donutWrap}>
              {loading ? (
                <Skeleton className={styles.donutSkeleton} />
              ) : gradeTotal === 0 ? (
                <div className={styles.empty}>No approvals yet.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        cursor={{
                          fill: "color-mix(in oklch, var(--foreground), transparent 94%)",
                        }}
                        contentStyle={{
                          fontSize: "0.75rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                        }}
                        formatter={(value, name) => [`${value} case(s)`, name as string]}
                      />
                      <Pie
                        data={gradeBreakdown}
                        dataKey="count"
                        nameKey="grade"
                        innerRadius="62%"
                        outerRadius="100%"
                        paddingAngle={1}
                        stroke="none"
                      >
                        {gradeBreakdown.map((g) => (
                          <Cell key={g.grade} fill={g.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutCenter}>
                    <span className={styles.donutTotal}>{total}</span>
                    <span className={styles.donutUnit}>total signed</span>
                  </div>
                </>
              )}
            </div>

            <div className={styles.legend}>
              {gradeBreakdown.map((g) => (
                <div key={g.grade} className={styles.legendItem}>
                  <span
                    className={styles.legendSwatch}
                    style={{ background: g.color }}
                  />
                  <span className={styles.legendLabel}>{g.grade}</span>
                  <span className={styles.legendCount}>
                    {loading ? "—" : g.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.insight}>
            <span className={styles.insightLabel}>Insight</span>
            <ul className={styles.insightList}>
              {insightItems.map((line, i) => (
                <li key={i} className={styles.insightItem}>
                  {line}
                </li>
              ))}
            </ul>
            {!loading && topGrade ? (
              <div className={styles.insightMeta}>
                <span className={styles.insightChip} style={{ background: topGrade.color }} />
                <span>
                  Leading grade:{" "}
                  <strong>{topGrade.grade}</strong> · {topGrade.count} case
                  {topGrade.count === 1 ? "" : "s"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.gridSection}>
        <div className={styles.gridHeader}>
          <div>
            <h2 className={styles.chartTitle}>Approved ADM Profiles</h2>
            <p className={styles.chartSubtitle}>
              Learners you&apos;ve signed and the documents attached to their ADM
              file.
            </p>
          </div>
          <div className={styles.gridControls}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, LRN, or case ID…"
                className={styles.search}
                aria-label="Search approved profiles"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${styles.filterBtn} ${
                    gradeFilter !== "all" ? styles.filterActive : ""
                  }`}
                >
                  Grade Level
                  {gradeFilter !== "all" && (
                    <span className={styles.filterDot} aria-hidden />
                  )}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                <DropdownMenuCheckboxItem
                  checked={gradeFilter === "all"}
                  onCheckedChange={() => setGradeFilter("all")}
                >
                  All grade levels
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {availableGrades.map((g) => (
                  <DropdownMenuCheckboxItem
                    key={g}
                    checked={gradeFilter === g}
                    onCheckedChange={() => setGradeFilter(g)}
                  >
                    {g}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className={styles.grid}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.cardSkeleton}>
                <Skeleton className={styles.skelAvatar} />
                <Skeleton className={styles.skelTitle} />
                <Skeleton className={styles.skelMeta} />
                <Skeleton className={styles.skelChips} />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <div className={styles.gridEmpty}>
              {search.trim()
                ? `No approved profiles match "${search}".`
                : gradeFilter === "all"
                  ? "No approved ADM profiles yet."
                  : `No approved profiles in ${gradeFilter}.`}
            </div>
          ) : (
            filteredRows.map((r) => (
              <article key={r.id} className={styles.profileCard}>
                <header className={styles.profileHead}>
                  <div className={styles.profileAvatar}>
                    {initials(r.student)}
                  </div>
                  <div className={styles.profileHeadText}>
                    <span className={styles.profileName}>{r.student}</span>
                    <span className={styles.profileLrn}>{r.lrn}</span>
                  </div>
                  <span className={styles.gradeText}>{r.grade}</span>
                </header>

                <div className={styles.profileMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Prepared by</span>
                    <span className={styles.metaValue}>{r.preparedBy}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Approved by</span>
                    <span className={styles.metaValue}>
                      {r.approvedBy ?? "—"}
                    </span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Case ID</span>
                    <span className={styles.metaValueMono}>{r.id}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Eligibility</span>
                    <span className={styles.eligText}>
                      {r.eligibilityStatus === "eligible"
                        ? "Eligible"
                        : r.eligibilityStatus === "ineligible"
                          ? "Ineligible"
                          : "Pending"}
                    </span>
                  </div>
                </div>

                <details className={styles.docs}>
                  <summary className={styles.docsSummary}>
                    <span className={styles.docsSummaryLabel}>
                      <FileText aria-hidden />
                      Attached Documents
                      <span className={styles.docCount}>
                        {r.forms?.length ?? 0}
                      </span>
                    </span>
                    <ChevronDown
                      className={styles.docsChevron}
                      aria-hidden
                    />
                  </summary>
                  <div className={styles.docsBody}>
                    {r.forms && r.forms.length > 0 ? (
                      <ul className={styles.docList}>
                        {r.forms.map((f) => (
                          <li key={f.id} className={styles.docItem}>
                            <FileText
                              aria-hidden
                              className={styles.docIcon}
                            />
                            <span className={styles.docTitle}>
                              {f.title}
                            </span>
                            <span
                              className={`${styles.docStatus} ${
                                f.status === "approved"
                                  ? styles.docStatusOk
                                  : f.status === "rejected"
                                    ? styles.docStatusBad
                                    : styles.docStatusPending
                              }`}
                            >
                              {f.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className={styles.docEmpty}>
                        No documents attached.
                      </span>
                    )}
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}