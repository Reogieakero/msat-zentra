"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BamaChat } from "./components/BamaChat";
import { TeacherEmptyCard } from "../components/TeacherEmptyCard";
import { KanbanBoardSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import chatStyles from "./components/bama-chat.module.css";
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
      <section className={chatStyles.page} aria-busy="true" aria-label="Loading chat">
        <div className={chatStyles.layout}>
          <Skeleton className="min-h-[30rem] w-full rounded-xl" />
          <div className={chatStyles.body}>
            <KanbanBoardSkeleton rows={6} className="flex-1" />
          </div>
        </div>
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
