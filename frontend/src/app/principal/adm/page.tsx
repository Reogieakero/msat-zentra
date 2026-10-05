import { AdmHeader } from "./components/AdmHeader";
import { AdmStats } from "./components/AdmStats";
import { AdmPipelineGuide } from "./components/AdmPipelineGuide";
import { AdmPipelineOverview } from "./components/AdmPipelineOverview";

export default function PrincipalAdmPage() {
  return (
    <>
      <AdmHeader />
      <AdmStats />
      <AdmPipelineOverview />
      <AdmPipelineGuide />
    </>
  );
}
