"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdmDashboard } from "@/services/principal/adm.service";
import { useTerm } from "@/lib/term/TermContext";
import { PrincipalPageHeader } from "../../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../../components/skeletons/PageHeaderSkeleton";

export function AdmHeader() {
  const { termReady } = useTerm();
  const { data, isPending, isError } = useQuery({
    queryKey: ["adm-dashboard"],
    queryFn: ({ signal }) => fetchAdmDashboard(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const total = (data?.stageBreakdown ?? []).reduce((sum, s) => sum + s.count, 0);
  const isEmpty = !isPending && !isError && total === 0;
  if (isPending || !termReady) return <PageHeaderSkeleton />;
  if (isEmpty) return null;
  return (
    <PrincipalPageHeader
      title="ADM Cases"
      description="Alternate Delivery Mode learner profiles — review referrals, track approvals, and monitor learner progress across the ADM pipeline."
    />
  );
}
