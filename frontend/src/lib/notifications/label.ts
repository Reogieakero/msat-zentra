/* Shared notification presentation helpers (nurse + coordinator bells).
   Titles are derived client-side from the backend `type` — the Notification
   table carries message/type/sourceTable/sourceId only (no title column). */

export function prettifyNotificationType(raw: string | null | undefined): string {
  if (!raw) return "Notice";
  const words = raw.replace(/^generic_/, "").split("_").filter(Boolean);
  if (words.length === 0) return "Notice";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function formatBellDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

export type BellNotificationTarget = { href: string } | null;

/* Where a bell item should navigate for its source. Role-scoped so the
   nurse bell never links into coordinator routes and vice versa. */
export function coordinatorNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null },
): BellNotificationTarget {
  if (n.sourceTable === "adm_devices") return { href: "/coordinator/devices" };
  if (n.sourceTable === "adm_parent_meetings") return { href: "/coordinator/referrals" };
  if (n.sourceTable === "adm_learner_profiles" && n.sourceId)
    return { href: `/coordinator/referrals/${n.sourceId}` };
  if (n.sourceTable === "referrals" && n.sourceId) return { href: "/coordinator/referrals" };
  return null;
}

export function nurseNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null },
): BellNotificationTarget {
  if (n.sourceTable === "referrals" && n.sourceId) return { href: "/nurse/alerts" };
  if (n.sourceTable === "adm_learner_profiles") return { href: "/nurse/referrals/adm" };
  return null;
}
