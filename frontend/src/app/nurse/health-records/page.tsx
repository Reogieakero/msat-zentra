"use client";

import { NursePlaceholder } from "../components/nurse-placeholder";

export default function NurseHealthRecordsPage() {
  return (
    <NursePlaceholder
      eyebrow="School Nurse · Clinic"
      title="Health records"
      description="Confidential clinic visit records: complaints, findings, and treatment given, including walk-ins. Nothing here is live yet."
      comingSoon={[
        "New visit form (complaint, diagnosis, treatment)",
        "Visit history per student",
        "Walk-in records without a referral",
      ]}
    />
  );
}
