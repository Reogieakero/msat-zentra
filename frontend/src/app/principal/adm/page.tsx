import { AdmHeader } from "./components/AdmHeader";
import { AdmStats } from "./components/AdmStats";
import { AdmPipelineOverview } from "./components/AdmPipelineOverview";
import { AdmRecentReferrals } from "./components/AdmRecentReferrals";

export default function PrincipalAdmPage() {
  return (
    <>
      <AdmHeader />
      <AdmStats />
      <AdmPipelineOverview />
      <AdmRecentReferrals />
    </>
  );
}
