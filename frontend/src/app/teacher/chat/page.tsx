"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BamaChat } from "./components/BamaChat";
import { useTeacherOverview } from "../overview/components/teacher-overview-data";

// Chat with Bama is an adviser-only filing surface: regular subject
// teachers get no nav item, and a direct URL bounces them back to Overview
// once the overview confirms they advise no section.
export default function TeacherChatPage() {
  return (
    <Suspense>
      <TeacherChatGate />
    </Suspense>
  );
}

function TeacherChatGate() {
  const router = useRouter();
  const overview = useTeacherOverview();
  const isAdviser = overview.data?.isAdviser ?? false;

  useEffect(() => {
    if (!overview.isPending && overview.data && !overview.data.isAdviser) {
      router.replace("/teacher/overview");
    }
  }, [overview.isPending, overview.data, router]);

  if (overview.isPending || overview.isError || !overview.data) {
    return (
      <section aria-busy="true" aria-label="Loading chat">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!isAdviser) {
    return (
      <section aria-label="Chat unavailable">
        <p className="text-sm text-muted-foreground">
          Chat with Bama is available to class advisers.
        </p>
      </section>
    );
  }

  return <BamaChat />;
}
