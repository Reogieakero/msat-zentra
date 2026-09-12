// Placeholder mock data for the remaining Guidance Counselor shells.
// The overview, alerts, and referrals pages are now wired live (see
// overview/components/, alerts/components/, and referrals/components/) and
// no longer read from this file. The exports below back the still-mocked
// sub-pages until their own endpoints land.

export const MOCK_ANECDOTALS = [
  { id: "ANEC-881", student: "Santos, Maria · G9-B", category: "Behavioral", observer: "Adviser G9-B", date: "Sep 08", confidentiality: "Restricted" },
  { id: "ANEC-877", student: "Reyes, Juan · G7-A", category: "Academic", observer: "Mr. Subject Teacher", date: "Sep 06", confidentiality: "Restricted" },
  { id: "ANEC-870", student: "Cruz, Ana · G10-C", category: "Emotional", observer: "Adviser G10-C", date: "Sep 03", confidentiality: "Confidential" },
  { id: "ANEC-864", student: "Garcia, Pedro · G8-A", category: "Attendance", observer: "Adviser G8-A", date: "Sep 01", confidentiality: "Restricted" },
];

export const MOCK_INTERVENTIONS = [
  { id: "INT-112", student: "Santos, Maria · G9-B", action: "Counseling session + behavior contract", status: "Pending review", outcome: "—", updated: "Sep 09" },
  { id: "INT-108", student: "Reyes, Juan · G7-A", action: "Study plan + weekly check-in", status: "Approved", outcome: "Ongoing", updated: "Sep 07" },
  { id: "INT-101", student: "Cruz, Ana · G10-C", action: "Peer mediation + parent conference", status: "Modified", outcome: "Ongoing", updated: "Sep 05" },
  { id: "INT-096", student: "Torres, Lucas · G8-B", action: "Referral to Nurse completed", status: "Approved", outcome: "Resolved", updated: "Aug 30" },
];

export const MOCK_ADM = [
  { id: "ADM-041", student: "Reyes, Juan · G7-A", stage: "Parent meeting", parentAttended: "Yes — Sep 06", status: "Ready for coordinator" },
  { id: "ADM-038", student: "Flores, Elena · G11-A", stage: "Home visitation", parentAttended: "No — visit scheduled", status: "Awaiting visit" },
  { id: "ADM-033", student: "Mendoza, Sofia · G9-A", stage: "Certification", parentAttended: "Yes — Aug 28", status: "With ADM Coordinator" },
];

export const MOCK_HEATMAP = [
  { section: "G7-A", high: 3, moderate: 2, low: 15 },
  { section: "G7-B", high: 1, moderate: 1, low: 18 },
  { section: "G9-B", high: 4, moderate: 2, low: 14 },
  { section: "G10-C", high: 2, moderate: 2, low: 16 },
  { section: "G11-A", high: 1, moderate: 1, low: 18 },
];
