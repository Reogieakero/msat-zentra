"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BamaChat } from "./components/BamaChat";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { ZentraPageHeaderSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { MessageSquareOff } from "lucide-react";
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
      <section className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading chat">
        <ZentraPageHeaderSkeleton />
        <ZentraTableSkeleton rows={6} columns={3} withPager={false} />
      </section>
    );
  }

  if (!isAdviser) {
    return (
      <TeacherEmptyCard
        centered
        icon={MessageSquareOff}
        title="Chat with Bama is available to class advisers"
        hint="Your account is not linked to an advisory section. Once assigned, adviser chat will appear here."
        label="Chat unavailable"
      />
    );
  }

  return <BamaChat />;
}
