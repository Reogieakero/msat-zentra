import { redirect } from "next/navigation";

/**
 * Legacy entry — referrals are now split into dedicated pages
 * (/nurse/referrals/adm and /nurse/referrals/clinic), so this route
 * forwards to ADM Cases to preserve old bookmarks.
 */
export default function NurseReferralsPage() {
  redirect("/nurse/referrals/adm");
}
