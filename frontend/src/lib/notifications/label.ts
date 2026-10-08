import { formatBellDate as sharedFormatBellDate, prettifyNotificationType as sharedPrettify } from "@/lib/labels/text";
export const prettifyNotificationType = sharedPrettify;
export const formatBellDate = sharedFormatBellDate;
export type BellNotificationTarget = { href: string } | null;
export function coordinatorNotificationTitle(n: {
  type: string;
  sourceTable?: string | null;
  message: string;
}): string {
  const msg = n.message ?? "";
  if (/^you booked a parent meeting/i.test(msg)) return "Action recorded";
  if (/^you moved the parent meeting/i.test(msg)) return "Action recorded";
  if (/^you recorded that parents/i.test(msg)) return "Action recorded";
  if (/^you certified/i.test(msg)) return "Action recorded";
  if (/^you endorsed/i.test(msg)) return "Action recorded";
  if (/^you moved/i.test(msg)) return "Action recorded";
  if (/^you issued learning device/i.test(msg)) return "Action recorded";
  if (/^you marked learning device/i.test(msg)) return "Action recorded";
  if (/^you (booked|moved|rescheduled|recorded|certified|endorsed|issued|completed|created)/i.test(msg))
    return "Action recorded";
  if (n.type === "device_issued" || n.type === "device_issued_self") return "Device issued";
  if (n.type === "device_returned" || n.type === "device_returned_self") return "Device returned";
  if (n.type === "device_overdue") return "Device return overdue";
  if (n.type === "meeting_booked" || n.type === "meeting_booked_self") return "Parent meeting booked";
  if (n.type === "meeting_rescheduled" || n.type === "meeting_rescheduled_self") return "Parent meeting rescheduled";
  if (n.type === "meeting_outcome" || n.type === "meeting_outcome_self") return "Meeting outcome recorded";
  if (n.type === "meeting_cancelled") return "Parent meeting cancelled";
  if (n.type === "principal_verdict") return "Principal verdict";
  if (n.type === "new_adm_referral") return "New ADM referral";
  if (/device .* overdue|overdue.*device/i.test(msg)) return "Device return overdue";
  if (/meeting .*cancelled|cancelled.*meeting/i.test(msg)) return "Parent meeting cancelled";
  if (/signed .* by the principal|principal.*signed/i.test(msg)) return "Principal verdict";
  if (n.sourceTable === "adm_devices") return "Device update";
  if (n.sourceTable === "adm_parent_meetings") return "Parent meeting update";
  if (/new .*referral submitted/i.test(msg)) return "New ADM referral submitted";
  if (/returned .*revision/i.test(msg)) return "Case returned for revision";
  if (/adm consultation endorsed/i.test(msg)) return "ADM consultation endorsed";
  if (/escalated to ADM/i.test(msg)) return "Case escalated to ADM";
  if (/reassigned to ADM/i.test(msg)) return "Case reassigned to ADM";
  if (/referred to ADM/i.test(msg)) return "New ADM referral";
  if (/re-submitted/i.test(msg)) return "Referral re-submitted";
  if (/was withdrawn/i.test(msg)) return "Referral withdrawn";
  if (n.type === "referral_status_change") return "Referral update";
  return sharedPrettify(n.type);
}
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
  if (/you escalated/i.test(msg)) return "Referral escalated";
  if (/you deleted a clinic session/i.test(msg)) return "Session deleted";
  if (/session .* was deleted/i.test(msg)) return "Session deleted";
  if (/you added session photos/i.test(msg)) return "Photos added";
  if (/documentation was added/i.test(msg)) return "Documentation added";
  if (/you removed a session photo/i.test(msg)) return "Photo removed";
  if (/documentation was removed/i.test(msg)) return "Documentation removed";
  if (/invited you to a parent meeting/i.test(msg)) return "Parent meeting invitation";
  if (/guidance booked a session/i.test(msg)) return "Guidance session booked";
  return sharedPrettify(n.type);
}
export function nurseNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null; message?: string | null },
): BellNotificationTarget {
  if (n.sourceTable === "referrals" && n.sourceId) {
    if (/adm/i.test(n.message ?? "")) {
      return { href: `/nurse/referrals/adm?highlight=${n.sourceId}` };
    }
    return { href: `/nurse/referrals/clinic?highlight=${n.sourceId}` };
  }
  if (
    (n.sourceTable === "counseling_sessions" ||
      n.sourceTable === "session_attachments") &&
    n.sourceId
  ) {
    return { href: `/nurse/referrals/clinic?highlight=${n.sourceId}` };
  }
  if (n.sourceTable === "adm_learner_profiles") return { href: "/nurse/referrals/adm" };
  if (n.sourceTable === "adm_parent_meetings") return { href: "/nurse/referrals/adm" };
  if (n.sourceTable === "adm_profiles") return { href: "/nurse/referrals/adm" };
  return null;
}
export function guidanceNotificationTarget(n: {
  sourceTable: string | null;
  sourceId: string | null;
  message?: string | null;
}): BellNotificationTarget {
  if (n.sourceTable === "referrals" && n.sourceId) {
    if (/adm/i.test(n.message ?? "")) {
      return { href: `/guidance/referrals/adm?highlight=${n.sourceId}` };
    }
    return { href: `/guidance/referrals/counseling?highlight=${n.sourceId}` };
  }
  if (
    (n.sourceTable === "counseling_sessions" ||
      n.sourceTable === "session_attachments") &&
    n.sourceId
  ) {
    if (/intervention session|follow-up/i.test(n.message ?? "")) {
      return { href: "/guidance/interventions" };
    }
    return { href: `/guidance/referrals/counseling?highlight=${n.sourceId}` };
  }
  if (n.sourceTable === "interventions") return { href: "/guidance/interventions" };
  if (n.sourceTable === "adm_parent_meetings") return { href: "/guidance/referrals/adm" };
  if (n.sourceTable === "adm_profiles") return { href: "/guidance/referrals/adm" };
  return null;
}
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
  if (/clinic booked a session/i.test(msg)) return "Clinic session booked";
  if (/you opened a .* follow-up/i.test(msg)) return "Follow-up opened";
  if (/you accepted a guidance referral/i.test(msg)) return "Referral accepted";
  if (/you booked a guidance session/i.test(msg)) return "Session booked";
  if (/you completed a guidance session/i.test(msg)) return "Session completed";
  if (/you completed a session and set a follow-up/i.test(msg)) return "Follow-up set";
  if (/you rescheduled a guidance session/i.test(msg)) return "Session rescheduled";
  if (/you cancelled a guidance session/i.test(msg)) return "Session cancelled";
  if (/you marked .* resolved/i.test(msg)) return "Referral resolved";
  if (/you requested more info/i.test(msg)) return "Info requested";
  if (/you set a follow-up/i.test(msg)) return "Follow-up set";
  if (/you started handling/i.test(msg)) return "Handling started";
  if (/you closed a guidance referral/i.test(msg)) return "Referral closed";
  if (/you dismissed a referral/i.test(msg)) return "Referral dismissed";
  if (/you moved .* pending/i.test(msg)) return "Moved to pending";
  if (/you added a note/i.test(msg)) return "Note added";
  if (/you endorsed an ADM consultation/i.test(msg)) return "ADM endorsed";
  if (/you forwarded an ADM referral/i.test(msg)) return "Sent to coordinator";
  if (/you did not endorse/i.test(msg)) return "ADM referral closed";
  if (/you escalated/i.test(msg)) return "Referral escalated";
  if (/you reassigned/i.test(msg)) return "Referral reassigned";
  if (/you sent a referral/i.test(msg)) return "Referral sent";
  if (/you (approved|rejected|modified) an intervention plan/i.test(msg)) {
    return "Intervention reviewed";
  }
  if (/you added session photos/i.test(msg)) return "Photos added";
  if (/documentation was added/i.test(msg)) return "Documentation added";
  if (/you removed a session photo/i.test(msg)) return "Photo removed";
  if (/documentation was removed/i.test(msg)) return "Documentation removed";
  if (/invited you to a parent meeting/i.test(msg)) return "Parent meeting invitation";
  if (/booked an intervention session/i.test(msg)) return "Intervention session booked";
  if (/completed an intervention session/i.test(msg)) return "Intervention session completed";
  if (/rescheduled an intervention session/i.test(msg)) return "Intervention session rescheduled";
  if (/cancelled an intervention session/i.test(msg)) return "Intervention session cancelled";
  if (n.type === "referral_status_change") return "Guidance referral update";
  return sharedPrettify(n.type);
}
export function teacherNotificationTitle(n: {
  type: string;
  sourceTable: string | null;
  message: string;
}): string {
  if (n.sourceTable === "adm_devices") return "Device update";
  if (n.sourceTable === "section_timetable_entries") {
    if (/sent back/i.test(n.message ?? "")) return "Schedule sent back";
    return "Schedule approved";
  }
  if (n.sourceTable === "teacher_names") {
    if (/unlinked/i.test(n.message ?? "")) return "Teacher code unlinked";
    if (/unlocked attendance/i.test(n.message ?? "")) return "Attendance unlocked";
    return "Teacher code linked";
  }
  if (/attendance .* (submitted|marked)/i.test(n.message ?? "")) return "Attendance submitted";
  if (/you saved scores/i.test(n.message ?? "")) return "Scores saved";
  if (/you filed an anecdotal record/i.test(n.message ?? "")) return "Record filed";
  if (/you enlisted/i.test(n.message ?? "")) return "Student enlisted";
  if (/you archived/i.test(n.message ?? "")) return "Student archived";
  if (/you restored/i.test(n.message ?? "")) return "Student restored";
  if (/you linked code/i.test(n.message ?? "")) return "Teacher code linked";
  if (/you withdrew a referral/i.test(n.message ?? "")) return "Referral withdrawn";
  if (/re-submitted/i.test(n.message ?? "")) return "Referral re-submitted";
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
    if (/clinic completed the referral form/i.test(msg)) return "Clinic completed referral form";
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
  return sharedPrettify(n.type);
}
export function teacherNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null; message?: string | null },
): BellNotificationTarget {
  if (n.sourceTable === "section_timetable_entries" && n.sourceId)
    return { href: `/teacher/schedule/${n.sourceId}` };
  if (n.sourceTable === "referrals" && n.sourceId) {
    if (/adm/i.test(n.message ?? "")) {
      return { href: `/teacher/advisory/adm-cases?highlight=${n.sourceId}` };
    }
    return { href: `/teacher/advisory/referrals?highlight=${n.sourceId}` };
  }
  if (n.sourceTable === "counseling_sessions" && n.sourceId)
    return { href: `/teacher/advisory/referrals?highlight=${n.sourceId}` };
  if (n.sourceTable === "interventions") return { href: "/teacher/advisory/referrals" };
  if (n.sourceTable === "adm_parent_meetings") return { href: "/teacher/advisory/referrals" };
  if (n.sourceTable === "adm_profiles") return { href: "/teacher/advisory/referrals" };
  return null;
}
export function principalNotificationTarget(
  n: { sourceTable: string | null; sourceId: string | null },
): BellNotificationTarget {
  if (n.sourceTable === "section_timetable_entries" && n.sourceId)
    return { href: `/principal/academics/schedule/${n.sourceId}` };
  if (n.sourceTable === "adm_devices") return { href: "/principal/adm" };
  return null;
}
export function registryNotificationTitle(
  desk: string,
  n: { type: string; sourceTable?: string | null; message: string }
): string {
  void desk;
  const msg = n.message ?? "";
  if (/sign-up.*awaiting approval/i.test(msg)) return "New student sign-up";
  if (/sf10 access requested/i.test(msg)) return "SF10 access requested";
  if (/finals ready/i.test(msg)) return "Finals ready for review";
  if (/needs validation/i.test(msg)) return "SF10 needs validation";
  if (/^you approved/i.test(msg)) return "Account approved";
  if (/^you rejected/i.test(msg)) return "Account rejected";
  if (/^you granted/i.test(msg)) return "Access granted";
  if (/^you denied/i.test(msg)) return "Access denied";
  if (/^you validated/i.test(msg)) return "SF10 validated";
  if (/^you released/i.test(msg)) return "SF10 released";
  if (/^you (created|updated|assigned|removed)/i.test(msg)) return "Academics updated";
  if (/sf10.*validated/i.test(msg)) return "SF10 validated";
  if (/sf10.*released/i.test(msg)) return "SF10 released";
  if (/sf10.*uploaded/i.test(msg)) return "SF10 uploaded";
  if (/your account has been approved/i.test(msg)) return "Account approved";
  if (/account request was not approved/i.test(msg)) return "Account rejected";
  if (/subject .*created|section .*created|teacher .*assigned/i.test(msg)) return "Academics updated";
  if (n.type === "account_pending") return "New student sign-up";
  if (n.type === "sf10_access_requested") return "SF10 access requested";
  if (n.type === "finals_ready") return "Finals ready for review";
  if (n.type === "sf10_needs_validation") return "SF10 needs validation";
  return sharedPrettify(n.type);
}
export function registrarNotificationTitle(n: {
  type: string;
  sourceTable?: string | null;
  message: string;
}): string {
  return registryNotificationTitle("registrar", n);
}
export function registrarNotificationTarget(n: {
  sourceTable: string | null;
  sourceId: string | null;
  message?: string | null;
}): BellNotificationTarget {
  if (n.sourceTable === "users") return { href: "/registrar/accounts" };
  if (n.sourceTable === "final_grades") return { href: "/registrar/final-grades" };
  if (n.sourceTable === "adviser_sf10_access_requests") return { href: "/registrar/adviser-access" };
  if (n.sourceTable === "sf10_records") return { href: "/registrar/sf10" };
  if (n.sourceTable === "subjects" || n.sourceTable === "sections" || n.sourceTable === "teacher_subject_assignments")
    return { href: "/registrar/academics" };
  return null;
}
export function recordKeeperNotificationTitle(n: {
  type: string;
  sourceTable?: string | null;
  message: string;
}): string {
  return registryNotificationTitle("record_keeper", n);
}
export function recordKeeperNotificationTarget(n: {
  sourceTable: string | null;
  sourceId: string | null;
  message?: string | null;
}): BellNotificationTarget {
  if (n.sourceTable === "users") return { href: "/record-keeper/accounts" };
  if (n.sourceTable === "final_grades") return { href: "/record-keeper/final-grades" };
  if (n.sourceTable === "adviser_sf10_access_requests") return { href: "/record-keeper/adviser-access" };
  if (n.sourceTable === "sf10_records") return { href: "/record-keeper/sf10" };
  if (n.sourceTable === "subjects" || n.sourceTable === "sections" || n.sourceTable === "teacher_subject_assignments")
    return { href: "/record-keeper/academics" };
  return null;
}
