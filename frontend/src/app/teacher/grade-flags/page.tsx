"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTeacherOverview } from "../overview/components/teacher-overview-data";
import { RaiseFlagChat } from "./components/RaiseFlagChat";
import { FlagHistory } from "./components/FlagHistory";
import styles from "./components/grade-flags.module.css";

export default function TeacherGradeFlagsPage() {
  const [view, setView] = useState<"compose" | "history">("compose");
  // Advisers don't raise grade flags — resolve first so the composer never
  // flashes for them. Errors fail open to the page (previous behavior).
  const overview = useTeacherOverview();
  if (overview.isPending) return null;
  const isAdviser = !!overview.data?.advisorySection;
  if (isAdviser) {
    return (
      <section className={styles.page}>
        <div className={styles.body}>
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-xl border border-input bg-card p-8 text-center">
            <p className="font-medium">Flagging isn&apos;t available for advisers</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Share concerns through an anecdotal record or a referral instead —
              your advisees&apos; teachers will see them there.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/teacher/anecdotal">Anecdotal records</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/teacher/advisory/referrals">Referrals</Link>
              </Button>
            </div>
          </div>
        </div>
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
