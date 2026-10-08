"use client";
import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { sessionTypeLabel } from "../../referrals/components/guidance-referrals-table";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import { listInterventionSessionDocs } from "@/services/guidance/interventions.service";
export function useRowViewer(followUp: AtRiskStudentItem["intervention"]) {
  const [viewer, setViewer] = React.useState<{
    files: { id: string; fileUrl: string; fileName: string }[];
    index: number;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = React.useState(false);
  const filesTotal =
    followUp?.sessions.reduce((n, s) => n + (s.attachmentsCount ?? 0), 0) ?? 0;
  async function openRowViewer() {
    if (!followUp || viewerLoading) return;
    setViewerLoading(true);
    try {
      const parts = await Promise.all(
        followUp.sessions.map(async (s) => {
          if ((s.attachmentsCount ?? 0) === 0) return [];
          const docs = await listInterventionSessionDocs(followUp.id, s.id);
          return docs.map((d) => ({
            id: d.id,
            fileUrl: d.fileUrl,
            fileName: `${sessionTypeLabel(s.sessionType)} — ${d.fileName}`,
          }));
        })
      );
      const files = parts.flat();
      if (files.length === 0) {
        toast.error({ title: "No attached images", description: "No documentary images filed on this case yet." });
        return;
      }
      setViewer({ files, index: 0 });
    } catch {
      toast.error({ title: "Could not load images", description: "Check your connection and try again." });
    } finally {
      setViewerLoading(false);
    }
  }
  return { viewer, setViewer, viewerLoading, openRowViewer, filesTotal };
}
