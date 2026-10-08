"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  assignAdviser,
  assignAdvisersBatch,
  createSection,
  deleteSection,
  fetchSections,
  fetchTeachers,
  regenerateAdviserCode,
} from "@/services/principal/assign.service";
import type {
  AdvisoryEntryInput,
  AdviserBatchInput,
  Section,
  SectionAdviserResult,
  Teacher,
} from "@/services/principal/assign.types";
import { markPrincipalAssignLocalMutation } from "@/lib/realtime/principalAssignRealtimeMeta";

export const assignSectionsKey = (schoolYearId: string) =>
  ["principal-assign", "sections", schoolYearId] as const;
export const assignTeachersKey = ["principal-assign", "teachers"] as const;

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  const serverMessage = data?.error?.message ?? data?.message;
  if (serverMessage) return serverMessage;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useAssignSectionsData(schoolYearId: string) {
  const sectionsQuery = useQuery({
    queryKey: assignSectionsKey(schoolYearId),
    queryFn: ({ signal }) => fetchSections(signal, schoolYearId),
    enabled: !!schoolYearId,
    staleTime: 30_000,
    retry: 1,
  });
  const teachersQuery = useQuery({
    queryKey: assignTeachersKey,
    queryFn: ({ signal }) => fetchTeachers(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return { sectionsQuery, teachersQuery };
}

type SectionsCache = Section[] | undefined;

export function useAssignAdvisers(schoolYearId: string, schoolYearName: string) {
  const queryClient = useQueryClient();
  const key = assignSectionsKey(schoolYearId);
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  const markPending = React.useCallback((ids: string[]) => {
    setPendingIds((prev) => new Set([...prev, ...ids]));
  }, []);

  const unmarkPending = React.useCallback((ids: string[]) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const applyFragments = React.useCallback(
    (
      fragments: Pick<
        SectionAdviserResult,
        "id" | "adviserId" | "adviserName" | "adviserLabel" | "adviserCode"
      >[],
    ) => {
      queryClient.setQueryData<SectionsCache>(key, (prev) =>
        prev?.map((sec) => {
          const u = fragments.find((f) => f.id === sec.id);
          return u
            ? {
                ...sec,
                adviserId: u.adviserId,
                adviserName: u.adviserName,
                adviserLabel: u.adviserLabel,
                adviserCode: (u as { adviserCode?: string }).adviserCode ?? sec.adviserCode ?? "",
              }
            : sec;
        }),
      );
    },
    [queryClient, key],
  );

  const batch = useMutation({
    mutationFn: async (entries: AdvisoryEntryInput[]) => {

      const sections = (queryClient.getQueryData<SectionsCache>(key) ?? []).filter(
        (s) => !s.id.startsWith("__temp-"),
      );
      const teachers = queryClient.getQueryData<Teacher[]>(assignTeachersKey) ?? [];
      const norm = (v: string) => v.trim().toLowerCase();
      const sectionIdByNorm = new Map<string, string>();
      for (const s of sections) sectionIdByNorm.set(`${s.gradeLevel}:${s.name.trim().toLowerCase()}`, s.id);
      const missing = [...new Map(
        entries
          .filter((e) => !sectionIdByNorm.has(`${e.gradeLevel}:${norm(e.sectionName)}`))
          .map((e) => [`${e.gradeLevel}:${norm(e.sectionName)}`, e] as const),
      ).values()];
      const created: Section[] = await Promise.all(
        missing.map((e) => createSection({ name: e.sectionName.trim(), gradeLevel: e.gradeLevel })),
      ).catch((err) => {

        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) void queryClient.invalidateQueries({ queryKey: key });
        throw err;
      });
      for (const s of created) sectionIdByNorm.set(`${s.gradeLevel}:${s.name.trim().toLowerCase()}`, s.id);

      const items: AdviserBatchInput[] = entries.map((e) => {
        const sectionId = sectionIdByNorm.get(`${e.gradeLevel}:${norm(e.sectionName)}`)!;
        const teacher = teachers.find((t) => t.name.trim().toLowerCase() === norm(e.adviserName));
        return {
          sectionId,
          sectionName: e.sectionName.trim(),
          gradeLevel: e.gradeLevel,
          adviserId: teacher?.id,
          adviserName: e.adviserName.trim(),
        };
      });
      const fragments = await assignAdvisersBatch(items);
      return { fragments, created };
    },
    onMutate: async (entries) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SectionsCache>(key);
      const sections = previous ?? [];
      const norm = (v: string) => v.trim().toLowerCase();

      const optimistic: {
        id: string;
        adviserId: string;
        adviserName: string;
        adviserLabel: string;
        adviserCode: string;
      }[] = [];
      const tempRows: Section[] = [];
      const seenTemp = new Set<string>();
      for (const e of entries) {
        const typed = e.adviserName.trim();
        const section = sections.find(
          (s) => s.gradeLevel === e.gradeLevel && norm(s.name) === norm(e.sectionName),
        );
        if (section) {
          optimistic.push({
            id: section.id,
            adviserId: "",
            adviserName: typed,
            adviserLabel: typed,
            adviserCode: section.adviserCode ?? "",
          });
        } else {
          const tempKey = `${e.gradeLevel}:${norm(e.sectionName)}`;
          if (seenTemp.has(tempKey)) continue;
          seenTemp.add(tempKey);
          tempRows.push({
            id: `__temp-${tempKey}`,
            name: e.sectionName.trim(),
            gradeLevel: e.gradeLevel,
            schoolYear: schoolYearName,
            schoolYearId,
            adviserId: "",
            adviserName: typed,
            adviserLabel: typed,
            adviserCode: "",
            assignments: [],
          });
        }
      }
      applyFragments(optimistic);
      if (tempRows.length > 0) {
        queryClient.setQueryData<SectionsCache>(key, (prev) =>
          [...(prev ?? []), ...tempRows].sort(
            (a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name),
          ),
        );
      }
      const pendingIds = [...optimistic.map((o) => o.id), ...tempRows.map((t) => t.id)];
      markPending(pendingIds);
      return { previous, pendingIds };
    },
    onError: (err, _entries, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error({
        title: "Assignment failed",
        description: getErrorMessage(err, "Failed to assign advisers. Nothing was saved."),
      });
    },
    onSuccess: ({ fragments, created }) => {

      queryClient.setQueryData<SectionsCache>(key, (prev) => {
        const withoutTemp = (prev ?? []).filter((s) => !s.id.startsWith("__temp-"));
        const have = new Set(withoutTemp.map((s) => s.id));
        const fresh = created.filter((c) => !have.has(c.id));
        return [...withoutTemp, ...fresh].sort(
          (a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name),
        );
      });
      applyFragments(fragments);
      markPrincipalAssignLocalMutation();
      const scope = schoolYearName || "active school year";
      const madeSuffix =
        created.length > 0
          ? ` · ${created.length} new section${created.length === 1 ? "" : "s"}: ${created.map((s) => s.name).join(", ")}.`
          : "";
      const codeSuffix =
        fragments.length === 1 && fragments[0]?.adviserCode
          ? ` Code ${fragments[0].adviserCode} — share it with ${fragments[0].adviserName}.`
          : "";
      toast.success({
        title: fragments.length > 1 ? `${fragments.length} advisers assigned` : "Adviser assigned",
        description: `${fragments.map((f) => `${f.adviserName} → ${f.name}`).join("; ")} (${scope}).${madeSuffix}${codeSuffix}`,
      });
    },
    onSettled: (data, _err, _entries, context) => {

      const ids = new Set<string>([
        ...(context?.pendingIds ?? []),
        ...((data?.fragments ?? []).map((f) => f.id)),
      ]);
      unmarkPending([...ids]);
    },
  });

  const clear = useMutation({
    mutationFn: (sectionId: string) => assignAdviser(sectionId, null),
    onMutate: async (sectionId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SectionsCache>(key);
      applyFragments([{ id: sectionId, adviserId: "", adviserName: "", adviserLabel: "", adviserCode: "" }]);
      markPending([sectionId]);
      return { previous };
    },
    onError: (err, _sectionId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error({
        title: "Removal failed",
        description: getErrorMessage(err, "Failed to remove adviser."),
      });
    },
    onSuccess: (updated) => {
      applyFragments([updated]);
      markPrincipalAssignLocalMutation();
      toast.success({ title: "Adviser removed", description: "The section has no adviser now." });
    },
    onSettled: (_data, _err, sectionId) => {
      unmarkPending([sectionId]);
    },
  });

  const regenerateCode = useMutation({
    mutationFn: (sectionId: string) => regenerateAdviserCode(sectionId),
    onMutate: async (sectionId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SectionsCache>(key);
      markPending([sectionId]);
      return { previous };
    },
    onError: (err, _sectionId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error({
        title: "Regenerate failed",
        description: getErrorMessage(err, "Failed to regenerate the advisory code."),
      });
    },
    onSuccess: (updated) => {
      applyFragments([updated]);
      markPrincipalAssignLocalMutation();
      toast.success({
        title: "New advisory code",
        description: `${updated.adviserName} → ${updated.name}: Code ${updated.adviserCode} — share it with the teacher.`,
      });
    },
    onSettled: (_data, _err, sectionId) => {
      unmarkPending([sectionId]);
    },
  });

  const removeSection = useMutation({
    mutationFn: (sectionId: string) => deleteSection(sectionId),
    onMutate: async (sectionId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SectionsCache>(key);
      const name = previous?.find((s) => s.id === sectionId)?.name ?? "Section";
      queryClient.setQueryData<SectionsCache>(key, (prev) =>
        prev?.filter((s) => s.id !== sectionId),
      );
      return { previous, name };
    },
    onError: (err, _sectionId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error({
        title: "Delete failed",
        description: getErrorMessage(err, "Failed to delete the section. Nothing was deleted."),
      });
    },
    onSuccess: (_data, _sectionId, context) => {
      markPrincipalAssignLocalMutation();
      toast.success({
        title: "Section deleted",
        description: `"${context?.name ?? "Section"}" was permanently deleted (${schoolYearName || "active school year"}).`,
      });
    },
  });

  return { batch, clear, regenerateCode, removeSection, pendingIds };
}
