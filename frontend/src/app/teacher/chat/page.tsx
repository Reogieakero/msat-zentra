"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BamaChat } from "./components/BamaChat";
import { useTeacherOverview } from "@/services/teacher/overview.service";

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
