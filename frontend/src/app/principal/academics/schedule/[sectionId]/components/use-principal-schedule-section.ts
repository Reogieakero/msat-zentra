"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Inbox, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  buildTimetable,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
interface SubmissionEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
  submittedAt: string | null;
  submitter: { fullName: string } | null;
}
interface Submission {
  id: string;
  name: string;
  gradeLevel: string;
  adviser: { fullName: string } | null;
  timetableEntries: SubmissionEntry[];
}
function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
export function usePrincipalScheduleSection(sectionId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const sectionsQuery = useQuery<{ sections: Submission[] }, unknown, Submission | null>({
    queryKey: ["principal-schedule-sections"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: Submission[] }>(
        "/api/academics/schedule/sections",
      );
      return data;
    },
    select: (d) => d.sections.find((s) => s.id === sectionId) ?? null,
    staleTime: 30_000,
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["principal-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
  });
  const submission = sectionsQuery.data ?? null;
  const review = useMutation({
    mutationFn: async (vars: { decision: "approve" | "reject"; note?: string }) => {
      const { data } = await apiClient.post("/api/academics/schedule/review", {
        sectionId,
        decision: vars.decision,
        note: vars.note,
      });
      return data as { approved?: number; rejected?: number };
    },
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["principal-schedule-sections"] });
      const name = submission?.name ?? "Section";
      if (vars.decision === "approve") {
        toast.success({
          title: "Schedule approved",
          description: `${data.approved ?? 0} slots for ${name} are now official.`,
        });
      } else {
        toast.success({
          title: "Sent back for revision",
          description: `${name} returned to draft with your note.`,
        });
      }
      router.push("/principal/academics/schedule");
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to record decision.");
      setPendingAction(null);
      setFormError(message);
      toast.error({ title: "Could not record decision", description: message });
    },
  });
  const config = configQuery.data?.config ?? null;
  const rows = config ? buildTimetable(config) : [];
  const entryByKey = new Map(
    (submission?.timetableEntries ?? []).map((e) => [`${e.day}:${e.period}`, e]),
  );
  const submittedCount = (submission?.timetableEntries ?? []).filter((e) => e.status === "SUBMITTED").length;
  const handleReview = (decision: "approve" | "reject") => {
    if (review.isPending) return;
    if (decision === "reject" && !note.trim()) {
      setFormError("A revision note is required to send a schedule back.");
      return;
    }
    setFormError(null);
    setPendingAction(decision);
    review.mutate({ decision, note: note.trim() || undefined });
  };
  const rejecting = review.isPending && pendingAction === "reject";
  const approving = review.isPending && pendingAction === "approve";
  const statusVariant =
    submittedCount > 0
      ? "blue"
      : (submission?.timetableEntries.length ?? 0) === 0
        ? "gray"
        : (submission?.timetableEntries ?? []).every((e) => e.status === "APPROVED")
          ? "green"
          : "red";
  const statusMeta = {
    blue: {
      title: "Submitted",
      message: `${submittedCount} slot${submittedCount === 1 ? "" : "s"} awaiting your review.`,
      from: "#3b82f6",
      to: "#2563d1",
      chip: "bg-blue-500/15",
      icon: "text-blue-500",
      Icon: Clock,
    },
    green: {
      title: "Approved",
      message: "Official schedule.",
      from: "#22c55e",
      to: "#16a34a",
      chip: "bg-green-500/15",
      icon: "text-green-500",
      Icon: Check,
    },
    red: {
      title: "Draft",
      message: "Not yet submitted for review.",
      from: "#ef4444",
      to: "#dc2626",
      chip: "bg-red-500/15",
      icon: "text-red-500",
      Icon: Pencil,
    },
    gray: {
      title: "Empty",
      message: "No timetable yet.",
      from: "#9ca3af",
      to: "#6b7280",
      chip: "bg-gray-500/15",
      icon: "text-gray-500",
      Icon: Inbox,
    },
  }[statusVariant];
  return {
    sectionsQuery,
    configQuery,
    submission,
    config,
    rows,
    entryByKey,
    submittedCount,
    review,
    note,
    setNote,
    formError,
    setFormError,
    reviewOpen,
    setReviewOpen,
    pendingAction,
    handleReview,
    rejecting,
    approving,
    statusVariant,
    statusMeta,
  };
}
export type { Submission, SubmissionEntry };
