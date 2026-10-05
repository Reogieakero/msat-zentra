/* Shared notification presentation helpers (nurse + coordinator + teacher +
   guidance bells).
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

/* Specific inbox titles for the nurse desk — mirrors nurseChannel.ts
   toastTitleFor verbatim so bell and sileo name each event identically.
   Messages carry the meaning (several types share one backend type), so
   titles derive from `message`, never the type alone. */
export function nurseNotificationTitle(n: {
  type: string;
  message: string;
}): string {
  const msg = n.message ?? "";
  if (/clinic referral submitted/i.test(msg)) return "New clinic referral";
  if (/referred to the clinic/i.test(msg)) return "New clinic referral";
  if (/escalated to the clinic/i.test(msg)) return "Case escalated to you";
  if (/reassigned to the clinic/i.test(msg)) return "Case reassigned to you";
  if (/needs consultation review/i.test(msg)) return "Consultation review needed";
  if (/under your review was withdrawn/i.test(msg)) return "Referral withdrawn";
  if (/withdrawn by the filing teacher/i.test(msg)) return "Referral withdrawn by teacher";
  if (/re-submitted/i.test(msg)) return "Referral re-submitted";
  if (/clinic accepted/i.test(msg)) return "Referral update";
  if (/you accepted a clinic referral/i.test(msg)) return "Clinic referral accepted";
  if (/you booked a clinic session/i.test(msg)) return "Clinic session booked";
  if (/you completed a clinic session/i.test(msg)) return "Clinic session completed";
  if (/you completed a session and set a follow-up/i.test(msg)) return "Follow-up set";
  if (/you rescheduled a clinic session/i.test(msg)) return "Clinic session rescheduled";
  if (/you cancelled a clinic session/i.test(msg)) return "Clinic session cancelled";
  if (/you marked .* resolved/i.test(msg)) return "Clinic referral resolved";
  if (/you requested more info/i.test(msg)) return "Info requested";
  if (/you set a follow-up/i.test(msg)) return "Follow-up set";
  if (/you started handling/i.test(msg)) return "Handling started";
  if (/you closed a clinic referral/i.test(msg)) return "Referral closed";
  if (/you moved .* pending/i.test(msg)) return "Moved to pending";
  if (/you endorsed an ADM consultation/i.test(msg)) return "ADM endorsed";
  if (/you forwarded an ADM referral/i.test(msg)) return "Sent to coordinator";
  if (/you did not endorse/i.test(msg)) return "ADM referral closed";
  if (/you completed the referral form/i.test(msg)) return "Referral form completed";
  // Invited to an ADM parent meeting by the coordinator.
  if (/invited you to a parent meeting/i.test(msg)) return "Parent meeting invitation";
  // Cross-desk booking on a shared ADM case (guidance booked).
  if (/guidance booked a session/i.test(msg)) return "Guidance session booked";
  return prettifyNotificationType(n.type);
}

export function nurseNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null; message?: string | null },
): BellNotificationTarget {
  // Clinic and ADM rows share sourceTable "referrals", so the message is
  // the desk signal: every nurse-bound ADM message names "ADM", clinic
  // messages never do. ADM rows land on the ADM cases page with the case
  // highlighted (the page scrolls to + highlights ?highlight=<id>).
  if (n.sourceTable === "referrals" && n.sourceId) {
    if (/adm/i.test(n.message ?? "")) {
      return { href: `/nurse/referrals/adm?highlight=${n.sourceId}` };
    }
    return { href: "/nurse/alerts" };
  }
  if (n.sourceTable === "adm_learner_profiles") return { href: "/nurse/referrals/adm" };
  // Invited to an ADM parent meeting — land on the ADM cases page (the
  // message + reminder card carry the student, time, and a deep link).
  if (n.sourceTable === "adm_parent_meetings") return { href: "/nurse/referrals/adm" };
  if (n.sourceTable === "adm_profiles") return { href: "/nurse/referrals/adm" };
  return null;
}

export function guidanceNotificationTarget(n: {
  sourceTable: string | null;
  sourceId: string | null;
  message?: string | null;
}): BellNotificationTarget {
  // ADM-track rows land on the ADM timeline with the case highlighted;
  // counseling rows on the Counseling timeline. Both desks share
  // sourceTable "referrals", so the message is the track signal — every
  // ADM-bound fanout names "ADM".
  if (n.sourceTable === "referrals" && n.sourceId) {
    if (/adm/i.test(n.message ?? "")) {
      return { href: `/guidance/referrals/adm?highlight=${n.sourceId}` };
    }
    return { href: `/guidance/referrals/counseling?highlight=${n.sourceId}` };
  }
  // Engine-detected interventions land on the interventions desk.
  if (n.sourceTable === "interventions") return { href: "/guidance/interventions" };
  // Invited to an ADM parent meeting — the meeting id can't highlight a case
  // row, so land on the ADM timeline (the message + reminder card carry the
  // student, time, and a deep link).
  if (n.sourceTable === "adm_parent_meetings") return { href: "/guidance/referrals/adm" };
  if (n.sourceTable === "adm_profiles") return { href: "/guidance/referrals/adm" };
  return null;
}

/* Specific inbox/toast titles for the guidance desk — every message shape
   the backend fans out to counselors, so the bell and the sileo name the
   event instead of the generic type. Strings mirror referrals.routes.ts,
   risk.routes.ts, and notify.ts TYPE_MAP verbatim. */
export function guidanceNotificationTitle(n: {
  type: string;
  message: string;
}): string {
  const msg = n.message ?? "";
  if (n.type === "intervention_detected") {
    if (/Moderate-risk intervention/i.test(msg)) return "New Moderate-risk intervention";
    return "New High-risk intervention";
  }
  if (/principal flagged/i.test(msg)) return "Principal flagged a student";
  if (/needs consultation review/i.test(msg)) return "ADM consultation needs review";
  if (/new guidance referral submitted/i.test(msg)) return "New counseling referral";
  if (/reassigned to guidance/i.test(msg)) return "Case reassigned to you";
  if (/withdrawn by the filing teacher/i.test(msg)) return "Referral withdrawn by teacher";
  if (/under your review was withdrawn/i.test(msg)) return "Referral withdrawn by teacher";
  if (/re-submitted/i.test(msg)) return "Referral re-submitted";
  if (/was sent to ADM/i.test(msg)) return "Sent to ADM";
  // Cross-desk booking on a shared ADM case (clinic booked).
  if (/clinic booked a session/i.test(msg)) return "Clinic session booked";
  if (/you opened a .* follow-up/i.test(msg)) return "Follow-up opened";
  // Invited to an ADM parent meeting by the coordinator.
  if (/invited you to a parent meeting/i.test(msg)) return "Parent meeting invitation";
  // Intervention session events (interventions.routes.ts session
  // endpoints) — self-receipts ("You …") land in the counselor's own bell;
  // assigned-to-another-counselor rows read "Guidance …".
  if (/booked an intervention session/i.test(msg)) return "Intervention session booked";
  if (/completed an intervention session/i.test(msg)) return "Intervention session completed";
  if (/rescheduled an intervention session/i.test(msg)) return "Intervention session rescheduled";
  if (/cancelled an intervention session/i.test(msg)) return "Intervention session cancelled";
  if (n.type === "referral_status_change") return "Guidance referral update";
  return prettifyNotificationType(n.type);
}

/* Specific inbox titles for the teacher/adviser desk — mirrors the
   referral branch of teacherChannel.ts toastTitleFor verbatim so bell and
   sileo name each event identically. Referral rows share type
   `referral_status_change`, so titles derive from `message`, never type. */
export function teacherNotificationTitle(n: {
  type: string;
  sourceTable: string | null;
  message: string;
}): string {
  if (n.sourceTable === "adm_devices") return "Device update";
  // Invited to an ADM parent meeting by the coordinator.
  if (/invited you to a parent meeting/i.test(n.message ?? "")) return "Parent meeting invitation";
  if (n.sourceTable === "adm_parent_meetings") {
    if (n.type === "generic_adm_parent_meetings_outcome") return "Meeting outcome recorded";
    return "Parent meeting booked";
  }
  if (n.sourceTable === "referrals" || n.type === "referral_status_change") {
    const msg = n.message ?? "";
    if (/clinic accepted your referral/i.test(msg)) return "Clinic accepted your referral";
    if (/clinic booked a session/i.test(msg)) return "Clinic session booked";
    if (/clinic completed a session/i.test(msg)) return "Clinic session completed";
    if (/clinic rescheduled a session/i.test(msg)) return "Clinic session rescheduled";
    if (/clinic cancelled a session/i.test(msg)) return "Clinic session cancelled";
    if (/clinic resolved your referral/i.test(msg)) return "Clinic resolved your referral";
    if (/clinic requested more info/i.test(msg)) return "Clinic requested more info";
    if (/clinic set a follow-up/i.test(msg)) return "Clinic follow-up set";
    if (/clinic started handling/i.test(msg)) return "Clinic started handling";
    if (/was closed/i.test(msg)) return "Clinic referral closed";
    if (/escalated to the clinic/i.test(msg)) return "Referral escalated to clinic";
    if (/escalated to ADM/i.test(msg)) return "Referral escalated to ADM";
    if (/was escalated/i.test(msg)) return "Referral escalated";
    if (/reassigned to the clinic/i.test(msg)) return "Referral reassigned to clinic";
    if (/was reassigned/i.test(msg)) return "Referral reassigned";
    if (/follow-up was set/i.test(msg)) return "Follow-up set";
    if (/was dismissed/i.test(msg)) return "Referral dismissed";
    if (/more info was requested/i.test(msg)) return "Info requested";
    if (/is now in progress/i.test(msg)) return "Referral in progress";
    if (/was marked resolved/i.test(msg)) return "Referral resolved";
    if (/pending review again/i.test(msg)) return "Referral pending";
    if (/guidance resolved your referral/i.test(msg)) return "Guidance resolved";
    if (/adm consultation endorsed/i.test(msg)) return "Sent to ADM coordinator";
    if (/forwarded to the coordinator/i.test(msg)) return "Sent to ADM coordinator";
    if (/not endorsed — case closed/i.test(msg)) return "ADM referral closed";
    if (/guidance accepted your referral/i.test(msg)) return "Guidance accepted your referral";
    if (/guidance booked a session/i.test(msg)) return "Guidance session booked";
    if (/guidance completed a session/i.test(msg)) return "Guidance session completed";
    if (/guidance rescheduled/i.test(msg)) return "Guidance session rescheduled";
    if (/guidance cancelled/i.test(msg)) return "Guidance session cancelled";
    if (/guidance resolved your referral/i.test(msg)) return "Guidance resolved your referral";
    if (/sent to ADM/i.test(msg)) return "Sent to ADM";
    if (/sent to the clinic/i.test(msg)) return "Sent to clinic";
    if (/re-submitted/i.test(msg)) return "Referral re-submitted";
    if (/withdrew a referral|you withdrew/i.test(msg)) return "Referral withdrawn";
    return "Referral update";
  }
  if (n.type === "new_followup") return "New follow-up";
  // Intervention session events for the case owner — before any
  // generic "guidance …" pattern so they never read as referral sessions.
  if (n.sourceTable === "interventions") {
    const iMsg = n.message ?? "";
    if (/booked an intervention session/i.test(iMsg)) return "Intervention session booked";
    if (/completed an intervention session/i.test(iMsg)) return "Intervention session completed";
    if (/rescheduled an intervention session/i.test(iMsg)) return "Intervention session rescheduled";
    if (/cancelled an intervention session/i.test(iMsg)) return "Intervention session cancelled";
    if (/opened a follow-up for/i.test(iMsg)) return "Follow-up opened";
    if (/recorded an outcome for/i.test(iMsg)) return "Follow-up outcome recorded";
    if (/the intervention plan for/i.test(iMsg)) return "Intervention plan reviewed";
  }
  if (n.type === "intervention_detected") {
    if (/flagged Moderate risk/i.test(n.message ?? "")) return "Advisee flagged Moderate risk";
    return "Advisee flagged High risk";
  }
  return prettifyNotificationType(n.type);
}

export function teacherNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null },
): BellNotificationTarget {
  // Schedule review verdicts carry the section id — deep-link to the
  // section's timetable, mirroring the principal review flow.
  if (n.sourceTable === "section_timetable_entries" && n.sourceId)
    return { href: `/teacher/schedule/${n.sourceId}` };
  // Clinic/guidance/ADM referral updates land on the adviser's referrals
  // list (status + timeline repaint live via ["myReferrals"] invalidation).
  if (n.sourceTable === "referrals") return { href: "/teacher/advisory/referrals" };
  if (n.sourceTable === "counseling_sessions")
    return { href: "/teacher/advisory/referrals" };
  // Engine-detected interventions on the adviser's section land on the
  // same referrals list (closest case surface for the advisee).
  if (n.sourceTable === "interventions") return { href: "/teacher/advisory/referrals" };
  // Invited to an ADM parent meeting — land on the referrals list (the
  // message + reminder card carry the student, time, and a deep link).
  if (n.sourceTable === "adm_parent_meetings") return { href: "/teacher/advisory/referrals" };
  if (n.sourceTable === "adm_profiles") return { href: "/teacher/advisory/referrals" };
  return null;
}

export function principalNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null },
): BellNotificationTarget {
  // Master-teacher submissions carry the section id — deep-link to the
  // section's review page instead of the bare queue.
  if (n.sourceTable === "section_timetable_entries" && n.sourceId)
    return { href: `/principal/academics/schedule/${n.sourceId}` };
  // ADM device issuance lands on the ADM board, the closest surviving
  // per-case view now that the approvals monitoring page is removed.
  if (n.sourceTable === "adm_devices") return { href: "/principal/adm" };
  return null;
}
