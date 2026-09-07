"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./ReferralsHeader.module.css";

interface ReferralData {
  status: "pending" | "in_progress" | "resolved";
}

interface ReferralsHeaderProps {
  referrals: ReferralData[];
  onNew: () => void;
}

export function ReferralsHeader({ referrals, onNew }: ReferralsHeaderProps) {
  const awaiting = referrals.filter((r) => r.status !== "resolved").length;

  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>Referrals</h1>
        <p className={styles.subtitle}>
          Cases you referred from your anecdotal records — {awaiting} awaiting
          action. Status and stage only, never clinical detail.
        </p>
      </div>
      <Button type="button" size="sm" onClick={onNew} className={styles.action}>
        <Plus aria-hidden />
        New referral
      </Button>
    </div>
  );
}
