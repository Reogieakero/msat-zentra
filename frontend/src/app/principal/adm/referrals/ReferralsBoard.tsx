import { AdmBoard } from "../AdmBoard";

export function ReferralsBoard() {
  return (
    <AdmBoard
      title="ADM Referrals"
      description="Learner profiles at the referral stage, routed from guidance or adviser."
    />
  );
}

export default function PrincipalAdmReferralsPage() {
  return <ReferralsBoard />;
}
