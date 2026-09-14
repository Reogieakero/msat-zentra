"use client";

import { NursePlaceholder } from "../components/nurse-placeholder";

export default function NurseRiskPage() {
  return (
    <NursePlaceholder
      eyebrow="School Nurse · Insights"
      title="Risk dashboard"
      description="School-wide health-related risk views the nurse is allowed to see. Only categories and levels — never other roles' confidential notes. Nothing here is live yet."
      comingSoon={[
        "Health-related risk levels by section",
        "Attendance and academic flags (category only)",
        "Trends over the term",
      ]}
    />
  );
}
