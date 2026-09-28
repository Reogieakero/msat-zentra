"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  assignSectionsKey,
  assignTeachersKey,
} from "@/app/principal/academics/assign/hooks/useAssignSections";
import type {
  Assignment,
  Section,
  Teacher,
} from "@/app/principal/academics/assign/api";
// Desk-agnostic event dedupe helpers (shared with the nurse desk).
import { realtimeEventKey, seenRealtimeEvent } from "./nurseRealtimeMeta";
import { wasRecentPrincipalAssignMutation } from "./principalAssignRealtimeMeta";

type SectionPayload = {
  eventType?: string;
  commit_timestamp?: string;
  new?: {
    id?: string;
    name?: string;
    gradeLevel?: string;
    schoolYearId?: string;
    adviserId?: string | null;
    adviserLabel?: string | null;
  } | null;
  old?: { id?: string } | null;
};

function gradeToNumber(gradeLevel: string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Principal assignment realtime sync — one shared Supabase channel per mount.
 *
 * - UPDATE on Section → merge ONLY `{adviserId, adviserName}` into the
 *   matching cached row (never a refetch, never a toast — silent merge).
 * - INSERT on Section → append the new row (principal-created sections appear
 *   live), scoped to the active school year.
 * - DELETE on Section → drop the row from cache.
 * - Initiator echo guard: our own mutation already updated the cache from the
 *   server response, so events inside the echo window are skipped.
 * - Adviser names resolve from the cached teachers list; on an unknown id we
 *   invalidate just the teachers query (rare, cheap) instead of refetching
 *   sections.
 * - Reconnect / visibility restore refetches ONLY the scoped sections query.
 */
export function usePrincipalAssignRealtime(enabled: boolean, schoolYearId: string, schoolYearName: string) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!enabled || !schoolYearId) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    let visibilityHandler: (() => void) | null = null;
    let onlineHandler: (() => void) | null = null;
    // Skip reconcile on the FIRST subscribe after mount — the query just
    // fetched, so an immediate invalidate would double the initial request.
    // Only re-subscribes (socket drop) reconcile.
    let subscribedOnce = false;
    const key = assignSectionsKey(schoolYearId);

    function mergeAdviser(sectionId: string, adviserId: string | null, adviserLabel: string | null) {
      if (wasRecentPrincipalAssignMutation()) return;
      const teachers = queryClient.getQueryData<Teacher[]>(assignTeachersKey) ?? [];
      let unknownTeacher = false;
      queryClient.setQueryData<Section[] | undefined>(key, (prev) => {
        if (!prev) return prev;
        let touched = false;
        const next = prev.map((sec) => {
          if (sec.id !== sectionId) return sec;
          touched = true;
          // Display name: linked teacher first, free-text label otherwise.
          const linked = adviserId ? teachers.find((t) => t.id === adviserId)?.name ?? null : "";
          if (adviserId && linked == null) unknownTeacher = true;
          const display = linked ?? adviserLabel ?? "";
          return {
            ...sec,
            adviserId: adviserId ?? "",
            adviserName: display,
            adviserLabel: adviserLabel ?? "",
          };
        });
        return touched ? next : prev;
      });
      if (unknownTeacher) {
        void queryClient.invalidateQueries({ queryKey: assignTeachersKey });
      }
    }

    function dropSection(sectionId: string) {
      if (wasRecentPrincipalAssignMutation()) return;
      queryClient.setQueryData<Section[] | undefined>(key, (prev) =>
        prev ? prev.filter((sec) => sec.id !== sectionId) : prev,
      );
    }

    function handleUpdate(payload: SectionPayload) {
      const id = payload.new?.id ?? null;
      if (!id) return;
      const eventKey = realtimeEventKey("Section", payload.eventType ?? "UPDATE", id, payload.commit_timestamp ?? null);
      if (seenRealtimeEvent(eventKey)) return;
      mergeAdviser(id, payload.new?.adviserId ?? null, payload.new?.adviserLabel ?? null);
    }

    function handleInsert(payload: SectionPayload) {
      const row = payload.new;
      const id = row?.id;
      const name = row?.name;
      const gradeLevel = row?.gradeLevel;
      const rowSchoolYearId = row?.schoolYearId;
      const rowAdviserId = row?.adviserId ?? null;
      if (!id || !name || !gradeLevel) return;
      // Only rows filed under this scope belong in this cache.
      if (rowSchoolYearId && rowSchoolYearId !== schoolYearId) return;
      const eventKey = realtimeEventKey("Section", payload.eventType ?? "INSERT", id, payload.commit_timestamp ?? null);
      if (seenRealtimeEvent(eventKey)) return;
      if (wasRecentPrincipalAssignMutation()) return;
      const teachers = queryClient.getQueryData<Teacher[]>(assignTeachersKey) ?? [];
      const adviserName = rowAdviserId
        ? (teachers.find((t) => t.id === rowAdviserId)?.name ?? row.adviserLabel ?? "")
        : (row.adviserLabel ?? "");
      queryClient.setQueryData<Section[] | undefined>(key, (prev) => {
        if (!prev) return prev;
        if (prev.some((sec) => sec.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            name,
            gradeLevel: gradeToNumber(gradeLevel) as Section["gradeLevel"],
            schoolYear: schoolYearName,
            schoolYearId,
            adviserId: rowAdviserId ?? "",
            adviserName,
            adviserLabel: row.adviserLabel ?? "",
            assignments: [] as Assignment[],
          },
        ].sort((a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));
      });
    }

    function handleDelete(payload: SectionPayload) {
      const id = payload.old?.id ?? null;
      if (!id) return;
      const eventKey = realtimeEventKey("Section", payload.eventType ?? "DELETE", id, payload.commit_timestamp ?? null);
      if (seenRealtimeEvent(eventKey)) return;
      dropSection(id);
    }

    function reconcile() {
      // Database is the source of truth — backfill anything missed, scoped to
      // this desk's sections query only.
      void queryClient.invalidateQueries({ queryKey: key });
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel("principal-assign")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "Section" },
          (payload) => void handleUpdate(payload as SectionPayload),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Section" },
          (payload) => void handleInsert(payload as SectionPayload),
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "Section" },
          (payload) => void handleDelete(payload as SectionPayload),
        );
      const sub = ch.subscribe((status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        if (!subscribedOnce) {
          subscribedOnce = true;
          return;
        }
        void reconcile();
      });
      if (!cancelled) channel = sub as unknown as { unsubscribe: () => void };

      visibilityHandler = () => {
        if (document.visibilityState === "visible") void reconcile();
      };
      onlineHandler = () => void reconcile();
      document.addEventListener("visibilitychange", visibilityHandler);
      window.addEventListener("online", onlineHandler);
    } catch {
      // Realtime unavailable — staleTime + window-focus refetch cover freshness.
    }

    return () => {
      cancelled = true;
      try {
        if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
        if (onlineHandler) window.removeEventListener("online", onlineHandler);
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, schoolYearId, schoolYearName, queryClient]);
}
