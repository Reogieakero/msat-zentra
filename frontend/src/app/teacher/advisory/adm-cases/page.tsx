"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FolderOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { writeLastViewedReferralId } from "../referrals/last-viewed";
import { AdmCaseCard } from "./components/AdmCaseCard";
import { AdmCaseRail } from "./components/AdmCaseRail";
import { fetchMyAdmCases, type AdmCase } from "./components/adm-cases-data";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/adm-cases.module.css";

const PAGE_SIZE = 50;

// Narrower cards than the section grid default.
const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))",
  gap: "0.75rem",
  minWidth: 0,
};

/**
 * Teacher ADM cases: every ADM case for the teacher's advisory students
 * (pending or principal-approved), one section-grid card per case.
 * Read-only — stage and status only, never confidential detail.
 */
export default function TeacherAdvisoryAdmCasesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [detailCase, setDetailCase] = useState<AdmCase | null>(null);

  const casesQuery = useQuery({
    queryKey: ["adm-my-cases"],
    queryFn: fetchMyAdmCases,
    retry: false,
  });
  const cases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);

  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = cases.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = cases.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, cases.length);

  function handleTrack(caseData: AdmCase) {
    // Deep-link into the referrals workflow canvas on this case's referral.
    writeLastViewedReferralId(caseData.referralId);
    setDetailCase(null);
    router.push("/teacher/advisory/referrals");
  }

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ADM Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cases.length === 1 ? "1 case" : `${cases.length} cases`} for your advisees.
          </p>
        </div>

        {casesQuery.isPending ? (
          <div style={GRID_STYLE} aria-busy="true" aria-label="Loading ADM cases">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skelCard} aria-hidden>
                <div className={styles.skelTop}>
                  <Skeleton className={styles.skelMini} />
                  <div className={styles.skelLines}>
                    <Skeleton className={styles.skelLine} />
                    <Skeleton className={styles.skelLineShort} />
                  </div>
                  <Skeleton className={styles.skelDot} />
                </div>
                <Skeleton className={styles.skelAvatar} />
                <Skeleton className={styles.skelName} />
                <Skeleton className={styles.skelSub} />
                <Skeleton className={styles.skelBar} />
                <div className={styles.skelActions}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            ))}
          </div>
        ) : casesQuery.isError ? (
          <p className={styles.pageError}>
            No advisory section assigned, or the cases could not be loaded. Contact the
            school office.
          </p>
        ) : cases.length === 0 ? (
          <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center">
            <div className={`${assign.card} mx-auto w-full max-w-md`}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col items-center gap-2 py-8 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <FolderOpen size={24} className="text-muted-foreground" />
                </span>
                <p className="font-medium">No ADM cases yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  None of your advisees are in the ADM pipeline. Cases appear here once an
                  ADM referral moves forward.
                </p>
                <Button size="sm" className="mt-2" onClick={() => router.push("/teacher/advisory/referrals")}>
                  <Send size={16} aria-hidden="true" />
                  Refer ADM cases
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`grid flex-1 items-stretch gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
              detailCase ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-4">
              <div style={GRID_STYLE} role="group" aria-label="ADM cases">
                {pageRows.map((c) => (
                  <AdmCaseCard
                    key={c.id}
                    caseData={c}
                    onDetails={() => setDetailCase(c)}
                  />
                ))}
              </div>
              <div className={`${styles.footer} mt-auto`}>
                <span className={styles.footerInfo}>
                  {cases.length > 0 ? `${start}–${end} of ${cases.length}` : "0 of 0"}
                </span>
                <div className={styles.footerActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1 || cases.length === 0}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft aria-hidden />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages || cases.length === 0}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
            <div className={`min-w-0 ${detailCase ? "" : "overflow-hidden"}`} inert={!detailCase}>
              <div
                className={`flex w-full max-w-full flex-col gap-4 self-start transition-all duration-300 ease-out motion-reduce:transition-none lg:fixed lg:top-16 lg:right-4 lg:bottom-4 lg:w-[20rem] lg:max-w-[20rem] lg:overflow-y-auto ${
                  detailCase ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                }`}
              >
                {detailCase ? (
                  <AdmCaseRail
                    caseData={detailCase}
                    onClose={() => setDetailCase(null)}
                    onTrack={handleTrack}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
