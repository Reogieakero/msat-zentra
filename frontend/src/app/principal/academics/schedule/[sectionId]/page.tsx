"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersistedRail } from "@/hooks/use-persisted-rail";
import { PrincipalPageHeader } from "../../../components/PrincipalPageHeader";
import { PrincipalEmptyCard } from "../../../components/PrincipalEmptyCard";
import { CalendarDays } from "lucide-react";
import { usePrincipalScheduleSection } from "./components/use-principal-schedule-section";
import { ScheduleReadonlyGrid } from "./components/schedule-readonly-grid";
import { ReviewPanel } from "./components/review-panel";
import { ReviewDialog } from "./components/review-dialog";
import { PageHeaderSkeleton } from "../../../components/skeletons/PageHeaderSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
function LoadingShell() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <PageHeaderSkeleton withActions />
      <Skeleton className="h-72 w-full" aria-hidden="true" />
    </section>
  );
}
export default function PrincipalSectionSchedulePage() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params.sectionId;
  const [railOpen, setRailOpen] = usePersistedRail("zentra.principal-schedule-rail", true);
  const {
    sectionsQuery,
    configQuery,
    submission,
    config,
    rows,
    entryByKey,
    submittedCount,
    review,
    note,
    setNote,
    formError,
    setFormError,
    reviewOpen,
    setReviewOpen,
    handleReview,
    rejecting,
    approving,
    statusMeta,
  } = usePrincipalScheduleSection(sectionId);
  if (sectionsQuery.isPending || configQuery.isPending) {
    return <LoadingShell />;
  }
  if (sectionsQuery.isError || !sectionsQuery.data) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p role="alert" className="text-sm text-destructive">Could not load schedule.</p>
      </section>
    );
  }
  if (!submission) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <PrincipalPageHeader
          title="Section not found"
          description="This section does not exist or is outside grades 7–10."
        />
        <PrincipalEmptyCard
          icon={CalendarDays}
          title="Section not found"
          hint="This section does not exist or is outside grades 7–10."
          action={
            <Button asChild>
              <Link href="/principal/academics/schedule">Back to sections</Link>
            </Button>
          }
        />
      </section>
    );
  }
  return (
    <section className="flex w-full flex-col gap-5">
      <div
        className={`grid items-start gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
        }`}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link href="/principal/academics/schedule">
                <ArrowLeft size={16} aria-hidden />
                Sections
              </Link>
            </Button>
            <PrincipalPageHeader
              title={`Schedule for ${submission.name}`}
              description={
                <>
                  {submission.gradeLevel}
                  {submission.adviser?.fullName
                    ? ` · Adviser: ${submission.adviser.fullName}`
                    : ""}
                  {` · ${submission.timetableEntries.length} slot${submission.timetableEntries.length === 1 ? "" : "s"}.`}
                </>
              }
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRailOpen((v) => !v)}
                  aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
                  title={railOpen ? "Hide sidebar" : "Show sidebar"}
                  aria-expanded={railOpen}
                >
                  {railOpen ? (
                    <PanelRightClose size={16} aria-hidden />
                  ) : (
                    <PanelRightOpen size={16} aria-hidden />
                  )}
                </Button>
              }
            />
          </div>
          <ScheduleReadonlyGrid config={config} rows={rows} entryByKey={entryByKey} />
        </div>
        <div className="min-w-0 overflow-hidden" inert={!railOpen}>
          <div
            className={`flex w-full flex-col gap-4 transition-all duration-300 ease-out motion-reduce:transition-none lg:w-[17rem] lg:max-w-[17rem] ${
              railOpen
                ? "translate-x-0 opacity-100"
                : "pointer-events-none opacity-0 lg:translate-x-6"
            }`}
          >
            <ReviewPanel
              submission={submission}
              submittedCount={submittedCount}
              statusMeta={statusMeta}
              note={note}
              onOpenReview={() => {
                setFormError(null);
                setReviewOpen(true);
              }}
              onReview={handleReview}
              rejecting={rejecting}
              approving={approving}
              reviewPending={review.isPending}
            />
          </div>
        </div>
      </div>
      <ReviewDialog
        open={reviewOpen}
        onClose={() => {
          if (review.isPending) return;
          setReviewOpen(false);
          setFormError(null);
        }}
        sectionName={submission?.name ?? "section"}
        sectionId={sectionId}
        note={note}
        onNoteChange={(v) => {
          setNote(v);
          setFormError(null);
        }}
        formError={formError}
        onReview={handleReview}
        rejecting={rejecting}
        approving={approving}
        reviewPending={review.isPending}
      />
    </section>
  );
}
