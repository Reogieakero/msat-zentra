"use client";

import * as React from "react";
import { Check, Copy, Inbox, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { DropdownSelect } from "./components/DropdownSelect";
import { AssignAdviserDialog } from "./components/AssignAdviserDialog";
import { ConfirmActionDialog } from "./components/ConfirmActionDialog";
import { STATUS_META } from "./components/status-dots";
import { AssignSkeleton } from "./components/AssignSkeleton";
import { useTerm } from "@/lib/term/TermContext";
import type { AdvisoryEntryInput, GradeLevel } from "./api";
import { useAssignAdvisers, useAssignSectionsData } from "./hooks/useAssignSections";
import { usePrincipalAssignRealtime } from "@/lib/realtime/principalAssignChannel";
import assign from "./components/section-assignments.module.css";
import page from "./assign.module.css";

// Principal is school-wide — every grade band (G7–G12).
const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12];

type DialogState = {
  grade: GradeLevel | null;
  sectionId: string;
};

// Avatar initials from the section name ("Macopa" → "MA", "St. Rosa" → "SR").
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

export default function PrincipalAssignPage() {
  // Global session scope (Login → select → active term). Advisory lives on the
  // Section row per school year — the scope travels on every request via the
  // API client's term headers, so this page never asks for it again.
  const { activeTerm } = useTerm();
  const schoolYearId = activeTerm?.schoolYearId ?? "";
  const schoolYearName = activeTerm?.schoolYearName ?? "";

  const [grade, setGrade] = React.useState<GradeLevel | null>(null);
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  // Confirm dialog for section deletion.
  const [confirmDelete, setConfirmDelete] = React.useState<{ sectionId: string; name: string } | null>(
    null,
  );

  // Cached data (react-query): sections for the active year + teachers once.
  const { sectionsQuery, teachersQuery } = useAssignSectionsData(schoolYearId);
  // Optimistic mutations: instant per-row feedback, rollback + toast on failure.
  const { batch, clear, regenerateCode, removeSection, pendingIds } = useAssignAdvisers(
    schoolYearId,
    schoolYearName,
  );
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const copyCode = React.useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1600);
      toast.success({ title: "Code copied", description: `${code} — share it with the teacher.` });
    } catch {
      toast.error({ title: "Copy failed", description: "Select the code and copy it manually." });
    }
  }, []);
  // Other principals' changes merge silently into the same cache.
  usePrincipalAssignRealtime(!!schoolYearId && sectionsQuery.isSuccess, schoolYearId, schoolYearName);

  const sections = React.useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const teachers = React.useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);

  // Sections available for the chosen grade level.
  const gradeSections = React.useMemo(
    () => (grade == null ? sections : sections.filter((s) => s.gradeLevel === grade)),
    [sections, grade],
  );

  const assignedCount = React.useMemo(
    () => gradeSections.filter((s) => s.adviserId || s.adviserName).length,
    [gradeSections],
  );

  // State machine: loading → skeleton; load error → error + retry;
  // loaded + empty → empty state; loaded + rows → content. Errors never
  // masquerade as "no data", and mutations never touch this machine.
  const hasNoScope = !schoolYearId;
  const isLoading = !!schoolYearId && sectionsQuery.isPending;
  const isError = !!schoolYearId && sectionsQuery.isError;
  const hasNoData = !isLoading && !isError && !!schoolYearId && sections.length === 0;

  const retry = () => {
    void sectionsQuery.refetch();
    void teachersQuery.refetch();
  };

  // Fire-and-forget: the hook paints optimistic cards in the same tick and
  // owns toasts/rollback, so the dialog closes instantly on submit.
  const submitBatch = (entries: AdvisoryEntryInput[]): void => {
    batch.mutate(entries);
  };

  const handleConfirmDelete = (): void => {
    if (!confirmDelete) return;
    removeSection.mutate(confirmDelete.sectionId);
    setConfirmDelete(null);
  };

  return (
    <section className={page.page} aria-busy={isLoading}>
      {isLoading ? (
        <AssignSkeleton />
      ) : hasNoScope ? (
        <div className={page.emptyState}>
          <Inbox className={page.emptyIcon} aria-hidden />
          <p className={page.emptyTitle}>No data to display</p>
          <p className={page.emptyText}>
            No active school year selected. Pick one from the top-bar badge first.
          </p>
        </div>
      ) : isError ? (
        <div className={page.emptyState} role="alert">
          <TriangleAlert className={page.emptyIcon} aria-hidden />
          <p className={page.emptyTitle}>Unable to load assignments</p>
          <p className={page.emptyText}>
            Sections for {schoolYearName || "the active school year"} could not be loaded.
          </p>
          <Button onClick={retry}>Retry</Button>
        </div>
      ) : hasNoData ? (
        <div className={page.emptyState}>
          <Inbox className={page.emptyIcon} aria-hidden />
          <p className={page.emptyTitle}>No data to display</p>
          <p className={page.emptyText}>
            No sections found{schoolYearName ? ` for ${schoolYearName}` : ""}. Sections you create
            will appear here for advisory assignment.
          </p>
          <div className={page.emptyActions}>
            <Button onClick={() => setDialog({ grade: null, sectionId: "" })}>
              Assign Advisory
            </Button>
          </div>
        </div>
      ) : (
        <>
          <header className={page.header}>
            <div className={page.headerRow}>
              <div>
                <h1 className={page.title}>Assigning — Section Advisers</h1>
                <p className={page.subtitle}>
                  School-wide (Grades 7–12). Working in <strong>{schoolYearName || "…"}</strong> —
                  input the section name and the adviser name.
                </p>
              </div>
              <Button
                onClick={() => setDialog({ grade, sectionId: "" })}
                disabled={batch.isPending}
              >
                Assign Advisory
              </Button>
            </div>
          </header>

          <div className={page.card}>
            <div className={assign.filterRow}>
              <div>
                <h2 className={page.cardTitle}>
                  {grade != null ? `Grade ${grade} sections` : "Sections & advisers"}
                </h2>
                <p className={page.cardSub}>
                  {`${assignedCount} of ${gradeSections.length} with adviser`}
                </p>
              </div>
              <div className={assign.filterActions}>
                <DropdownSelect
                  ariaLabel="Filter by grade level"
                  value={grade != null ? String(grade) : "all"}
                  onValueChange={(v) => setGrade(v === "all" ? null : (Number(v) as GradeLevel))}
                  options={[
                    { value: "all", label: "All grades" },
                    ...GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` })),
                  ]}
                  placeholder="All grades"
                />
              </div>
            </div>
            {gradeSections.length === 0 ? (
              <div className={assign.emptyCenter}>
                <Inbox className={assign.emptyIcon} aria-hidden />
                <p className={assign.emptyCenterTitle}>No data to display</p>
                <p className={assign.emptyCenterText}>
                  {grade == null
                    ? "No sections in this scope yet."
                    : `No Grade ${grade} sections this scope.`}
                </p>
              </div>
            ) : (
              <div className={assign.grid}>
                {gradeSections.map((s) => {
                  const pending = pendingIds.has(s.id);
                  // Claimed = teacher entered the advisory code and holds the
                  // seat. Locked: no Change, no Delete.
                  // Pending = principal listed a name + code, awaiting claim.
                  // Empty = no adviser yet.
                  const claimed = !!s.adviserId;
                  const awaitingClaim = !claimed && !!s.adviserName;
                  const code = (s as { adviserCode?: string }).adviserCode ?? "";
                  const busy =
                    pending || batch.isPending || removeSection.isPending || regenerateCode.isPending;
                  return (
                    <div key={s.id} className={assign.card} aria-busy={pending || undefined}>
                      <span className={assign.glowClip} aria-hidden>
                        <span className={assign.cardGlow} />
                      </span>
                      {/* Primary tokens flip with the theme (near-black on light,
                          near-white on dark) so the badge background always
                          contrasts the card surface. */}
                      <Badge
                        variant="secondary"
                        className={`${assign.gradeBadge} ${assign.gradeFloat}`}
                        style={{
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                          borderColor: "transparent",
                        }}
                      >
                        Grade {s.gradeLevel}
                      </Badge>
                      <div className={assign.cardHead}>
                        <span className={assign.avatar} aria-hidden>
                          {initialsOf(s.name)}
                        </span>
                        <div className={assign.cardTitleBlock}>
                          <span className={assign.fieldLabel}>Section</span>
                          <span className={assign.itemName} title={s.name}>
                            {s.name}
                          </span>
                        </div>
                        {claimed ? (
                          <span className={assign.claimMark}>
                            <span
                              className={assign.statusDot}
                              style={{ backgroundColor: STATUS_META.progress.color }}
                              aria-hidden
                            />
                            <span className={assign.claimLabel}>Claim</span>
                          </span>
                        ) : awaitingClaim ? (
                          <span className={assign.claimMark}>
                            <span
                              className={assign.statusDot}
                              style={{ backgroundColor: "#d97706" }}
                              aria-hidden
                            />
                            <span className={assign.claimLabel}>Awaiting claim</span>
                          </span>
                        ) : null}
                      </div>
                      <div className={assign.teacherBlock}>
                        <span className={assign.fieldLabel}>Teacher</span>
                        <span className={assign.itemTeacher}>
                          {pending ? (
                            <span className={assign.pendingWrap}>
                              <Loader2 className={assign.pendingSpin} aria-hidden />
                              {s.adviserName || "Assigning…"}
                            </span>
                          ) : (
                            s.adviserName || <span className={assign.itemTerm}>No adviser</span>
                          )}
                        </span>
                      </div>
                      {awaitingClaim && code ? (
                        <div className={assign.teacherBlock}>
                          <span className={assign.fieldLabel}>Advisory code</span>
                          <span
                            className={assign.itemTeacher}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <code
                              style={{
                                fontFamily: "ui-monospace, monospace",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {code}
                            </code>
                            <Button
                              variant="ghost"
                              size="xs"
                              aria-label={`Copy advisory code for ${s.name}`}
                              disabled={busy}
                              onClick={() => void copyCode(code)}
                            >
                              {copiedCode === code ? (
                                <Check size={13} aria-hidden />
                              ) : (
                                <Copy size={13} aria-hidden />
                              )}
                              {copiedCode === code ? "Copied" : "Copy"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              aria-label={`Regenerate advisory code for ${s.name}`}
                              title="Mint a replacement code — the old one stops working"
                              disabled={busy}
                              onClick={() => regenerateCode.mutate(s.id)}
                            >
                              <RefreshCw size={13} aria-hidden />
                              New code
                            </Button>
                          </span>
                          <span className={assign.itemTerm}>
                            Share this code with {s.adviserName} — they enter it to claim the seat.
                          </span>
                        </div>
                      ) : null}
                      <div className={`${assign.cardActions} justify-end`}>
                        <Button
                          size="xs"
                          aria-label={`Assign adviser for ${s.name}`}
                          title={claimed ? "Claimed by a teacher — locked" : undefined}
                          disabled={busy || claimed}
                          onClick={() => setDialog({ grade: s.gradeLevel, sectionId: s.id })}
                        >
                          {s.adviserName ? "Change" : "Assign"}
                        </Button>
                        {awaitingClaim ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`Clear adviser for ${s.name}`}
                            title="Clear the listed adviser and code"
                            disabled={busy}
                            onClick={() => clear.mutate(s.id)}
                          >
                            Clear
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="xs"
                          className={assign.deleteButton}
                          aria-label={`Delete ${s.name} section`}
                          title={claimed ? "Claimed by a teacher — locked" : undefined}
                          disabled={busy || claimed}
                          onClick={() => setConfirmDelete({ sectionId: s.id, name: s.name })}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {dialog ? (
        <AssignAdviserDialog
          sections={sections}
          teachers={teachers}
          schoolYearName={schoolYearName}
          initialGrade={dialog.grade}
          initialSectionId={dialog.sectionId}
          isAssigning={batch.isPending}
          onClose={() => setDialog(null)}
          onSubmit={submitBatch}
          onAssigned={() => setDialog(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmActionDialog
          title="Delete section?"
          description={`"${confirmDelete.name}" will be permanently deleted. This is only allowed while it has no students or records.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </section>
  );
}
