"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { RaiseFlagChat } from "./components/RaiseFlagChat";
import { FlagHistory } from "./components/FlagHistory";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { ZentraPageHeaderSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { ShieldAlert } from "lucide-react";
import styles from "./components/grade-flags.module.css";

export default function TeacherGradeFlagsPage() {
  const [view, setView] = useState<"compose" | "history">("compose");

  const overview = useTeacherOverview();
  if (overview.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading grade flags">
        <ZentraPageHeaderSkeleton />
        <ZentraTableSkeleton rows={6} columns={4} />
      </section>
    );
  }
  const isAdviser = !!overview.data?.advisorySection;
  if (isAdviser) {
    return (
      <section className={styles.page}>
        <TeacherEmptyCard
          centered
          icon={ShieldAlert}
          title="Flagging isn't available for advisers"
          hint="Share concerns through an anecdotal record or a referral instead — your advisees' teachers will see them there."
          label="Grade flags unavailable"
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/teacher/anecdotal">Anecdotal records</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/teacher/advisory/referrals">Referrals</Link>
              </Button>
            </div>
          }
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {view === "compose" ? (
        <div className={styles.body}>
          <RaiseFlagChat onHistory={() => setView("history")} />
        </div>
      ) : (
        <div className={styles.boardWrap}>
          <FlagHistory onBack={() => setView("compose")} />
        </div>
      )}
    </section>
  );
}
