"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrincipalEmptyCard } from "../../../components/PrincipalEmptyCard";
import { CalendarDays } from "lucide-react";
import { usePrincipalScheduleSection } from "./components/use-principal-schedule-section";
import { ScheduleReadonlyGrid } from "./components/schedule-readonly-grid";
import { SectionCard } from "./components/section-card";
import { SectionRail } from "./components/section-rail";
import { ReviewDialog } from "./components/review-dialog";
import { Skeleton } from "@/components/ui/skeleton";
function LoadingShell() {
  return (
    <section className="flex w-full flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-7 w-24" aria-hidden="true" />
          <Skeleton className="h-72 w-full" aria-hidden="true" />
        </div>
        <div className="flex flex-col items-end gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}
export default function PrincipalSectionSchedulePage() {
  const params = useParams<{ sectionId: string }>();
  const sectionRef = params.sectionId;
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
  } = usePrincipalScheduleSection(sectionRef);
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
        <PrincipalEmptyCard
          icon={CalendarDays}
          title="Section not found"
          hint="This section does not exist or is outside grades 7–12."
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
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link href="/principal/academics/schedule">
                <ArrowLeft size={16} aria-hidden />
                Sections
              </Link>
            </Button>
          </div>
          <SectionCard submission={submission} statusTitle={statusMeta.title} />
          <ScheduleReadonlyGrid config={config} rows={rows} entryByKey={entryByKey} />
        </div>
        <div className="min-w-0">
          <div className="flex w-full flex-col gap-4">
            <SectionRail
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
        submission={submission}
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
