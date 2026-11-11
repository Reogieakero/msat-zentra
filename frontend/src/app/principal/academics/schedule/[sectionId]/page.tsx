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
import { SectionScheduleSkeleton } from "./components/section-schedule-skeleton";
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
    return <SectionScheduleSkeleton />;
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
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-6 px-2 text-xs">
          <Link href="/principal/academics/schedule">
            <ArrowLeft size={14} aria-hidden />
            Back to sections
          </Link>
        </Button>
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
      <div className="flex min-w-0 flex-col gap-5">
        <SectionCard submission={submission} statusTitle={statusMeta.title} />
        <ScheduleReadonlyGrid config={config} rows={rows} entryByKey={entryByKey} />
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
