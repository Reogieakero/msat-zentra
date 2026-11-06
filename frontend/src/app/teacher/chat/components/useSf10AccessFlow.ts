"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  createAccessRequest,
  useMyAccessRequests,
} from "@/services/teacher/sf10Access.service";
import {
  nextMessageId,
  type BamaConversation,
  type BamaMessage,
} from "./bama-conversations";

interface UseSf10AccessFlowArgs {
  active: BamaConversation | null;
  activeId: string | null;
  hydrated: boolean;
  setConversations: Dispatch<SetStateAction<BamaConversation[]>>;
  draft: string;
  setDraft: (next: string) => void;
}

export type Sf10Phase = "section" | "students" | "reason" | "review";

interface Sf10Snapshot {
  sectionId: string;
  pickedLrns: string[];
  reason: string;
  phase: Sf10Phase;
}

const EMPTY_SF10: Sf10Snapshot = { sectionId: "", pickedLrns: [], reason: "", phase: "section" };
const SNAP_KEY = "zentra.bama.sf10flow.v1";
const REASON_MAX = 500;

const PHASES: Sf10Phase[] = ["section", "students", "reason", "review"];

function sanitizeSnapshot(raw: unknown): Sf10Snapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const phase = PHASES.includes(s.phase as Sf10Phase) ? (s.phase as Sf10Phase) : "section";
  const pickedLrns = Array.isArray(s.pickedLrns)
    ? (s.pickedLrns as unknown[]).filter((l): l is string => typeof l === "string")
    : [];
  return {
    sectionId: typeof s.sectionId === "string" ? s.sectionId : "",
    pickedLrns,
    reason: typeof s.reason === "string" ? s.reason : "",
    phase,
  };
}

function loadSnapshots(): Record<string, Sf10Snapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, Sf10Snapshot> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const snap = sanitizeSnapshot(v);
      if (snap) out[k] = snap;
    }
    return out;
  } catch {
    return {};
  }
}

function saveSnapshots(snaps: Record<string, Sf10Snapshot>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAP_KEY, JSON.stringify(snaps));
  } catch {
    // Storage is best-effort; the chat history itself is the source of truth.
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })
    ?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export interface Sf10AccessFlow {
  sections: { id: string; name: string; gradeLevel: string }[];
  sectionName: string;
  gradeLevel: string;
  rosterPending: boolean;
  phase: Sf10Phase;
  pickedLrns: string[];
  pickedCount: number;
  candidateCount: number;
  studentMatches: { lrn: string; name: string }[];
  studentRows: { lrn: string; name: string }[];
  studentQ: string;
  setStudentQ: (next: string) => void;
  reason: string;
  canSubmit: boolean;
  submitting: boolean;
  flowError: string | null;
  sectionHasActive: boolean;
  sectionActiveStatus: string | null;
  handleSectionPick: (id: string) => void;
  toggleLrn: (lrn: string) => void;
  selectAll: () => void;
  clearPicks: () => void;
  handleStudentsDone: () => void;
  handleReasonSend: () => void;
  editReason: () => void;
  submitRequest: () => Promise<void>;
  resetFlowStates: () => void;
  removeFlowSnapshot: (id: string) => void;
}

export function useSf10AccessFlow({
  active,
  activeId,
  hydrated,
  setConversations,
  draft,
  setDraft,
}: UseSf10AccessFlowArgs): Sf10AccessFlow {
  const queryClient = useQueryClient();
  const dock = useDock();
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [snaps, setSnaps] = useState<Record<string, Sf10Snapshot>>({});
  const [sectionId, setSectionId] = useState("");
  const [pickedLrns, setPickedLrns] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<Sf10Phase>("section");
  const [studentQ, setStudentQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const autoPickedRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- client-only store hydration */
  useEffect(() => {
    setSnaps(loadSnapshots());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function resetFlowStates() {
    setSectionId(EMPTY_SF10.sectionId);
    setPickedLrns(EMPTY_SF10.pickedLrns);
    setReason(EMPTY_SF10.reason);
    setPhase(EMPTY_SF10.phase);
    setStudentQ("");
    setFlowError(null);
  }

  function removeFlowSnapshot(id: string) {
    setSnaps((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      saveSnapshots(next);
      return next;
    });
  }

  /* eslint-disable react-hooks/set-state-in-effect -- chat-switch snapshot restore + persistence */
  useEffect(() => {
    if (!hydrated) return;
    const snap = activeId ? snaps[activeId] : undefined;
    if (!snap) {
      resetFlowStates();
      return;
    }
    setSectionId(snap.sectionId);
    setPickedLrns(snap.pickedLrns);
    setReason(snap.reason);
    setPhase(snap.phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeId || active?.type !== "sf10-access") return;
    const snap: Sf10Snapshot = { sectionId, pickedLrns, reason, phase };
    setSnaps((prev) => {
      const next = { ...prev, [activeId]: snap };
      saveSnapshots(next);
      return next;
    });
  }, [hydrated, activeId, active?.type, sectionId, pickedLrns, reason, phase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rosterQuery = useAdvisoryRoster();
  const sections = useMemo(
    () => rosterQuery.data?.advisorySections ?? [],
    [rosterQuery.data],
  );
  const section = useMemo(
    () => sections.find((s) => s.id === sectionId) ?? null,
    [sections, sectionId],
  );
  const sectionStudents = useMemo(() => {
    const all = rosterQuery.data?.students ?? [];
    if (!section) return [];
    if (sections.length <= 1) return all;
    return all.filter((s) => s.section === section.name);
  }, [rosterQuery.data, sections.length, section]);

  const requestsQuery = useMyAccessRequests(!!rosterQuery.data);
  const sectionActiveStatus = useMemo(() => {
    if (!sectionId) return null;
    const hit = (requestsQuery.data ?? []).find(
      (r) => r.sectionId === sectionId && (r.status === "pending" || r.status === "approved"),
    );
    return hit?.status ?? null;
  }, [requestsQuery.data, sectionId]);

  function pushToActive(msgs: BamaMessage[]) {
    if (!activeId) return;
    const id = activeId;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, ...msgs], updatedAt: Date.now() } : c))
    );
  }

  function handleSectionPick(id: string) {
    if (phase !== "section") return;
    const picked = sections.find((s) => s.id === id);
    if (!picked) return;
    setSectionId(id);
    setPickedLrns([]);
    setPhase("students");
    setFlowError(null);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && c.title === "New chat" ? { ...c, title: `${picked.name} · SF10 access` } : c
      )
    );
    const existing = (requestsQuery.data ?? []).find(
      (r) => r.sectionId === id && (r.status === "pending" || r.status === "approved"),
    );
    pushToActive([
      { id: nextMessageId(), from: "user", text: `${picked.name} · ${picked.gradeLevel}`, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text:
          `Who needs SF10 access in ${picked.name}? Select students below, then press Done.` +
          (existing ? ` Note: this section already has a ${existing.status} request.` : ""),
        at: Date.now(),
      },
    ]);
  }

  // Single-section advisers skip the picker entirely.
  useEffect(() => {
    if (!hydrated || !active || active.type !== "sf10-access" || active.filed) return;
    if (phase !== "section" || sections.length !== 1) return;
    if (autoPickedRef.current === active.id) return;
    if (active.messages.some((m) => m.from === "user")) return;
    autoPickedRef.current = active.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-advance for single-section advisers
    handleSectionPick(sections[0].id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hydrated, activeId, active?.type, phase, sections]);

  function toggleLrn(lrn: string) {
    if (phase !== "students") return;
    setPickedLrns((prev) => (prev.includes(lrn) ? prev.filter((x) => x !== lrn) : [...prev, lrn]));
    setFlowError(null);
  }

  function selectAll() {
    if (phase !== "students") return;
    setPickedLrns(sectionStudents.map((s) => s.lrn));
    setFlowError(null);
  }

  function clearPicks() {
    if (phase !== "students") return;
    setPickedLrns([]);
    setFlowError(null);
  }

  function handleStudentsDone() {
    if (phase !== "students" || pickedLrns.length === 0) return;
    setPhase("reason");
    setFlowError(null);
    const names = sectionStudents
      .filter((s) => pickedLrns.includes(s.lrn))
      .map((s) => s.name);
    const shown = names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4} more` : "");
    pushToActive([
      { id: nextMessageId(), from: "user", text: `${pickedLrns.length} selected: ${shown}`, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Why do you need SF10 access? Type the reason below (max 500 characters).",
        at: Date.now(),
      },
    ]);
  }

  function handleReasonSend() {
    if (submitting || !active || active.filed || phase !== "reason") return;
    const value = draft.trim();
    if (!value) return;
    if (value.length > REASON_MAX) {
      setFlowError(`Keep the reason to ${REASON_MAX} characters or fewer (now ${value.length}).`);
      return;
    }
    setReason(value);
    setPhase("review");
    setFlowError(null);
    setDraft("");
    const picked = sectionStudents.filter((s) => pickedLrns.includes(s.lrn));
    pushToActive([
      { id: nextMessageId(), from: "user", text: value, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Review the request before submitting:",
        at: Date.now(),
        sf10Preview: {
          section: section?.name ?? "",
          gradeLevel: section?.gradeLevel ?? "",
          studentCount: pickedLrns.length,
          studentNames: picked.map((s) => s.name),
          lrns: [...pickedLrns],
          reason: value,
          filedOn: "",
        },
      },
    ]);
  }

  function editReason() {
    if (phase !== "review") return;
    setPhase("reason");
    setDraft(reason);
    setFlowError(null);
    pushToActive([
      { id: nextMessageId(), from: "assistant", text: "Type the revised reason below.", at: Date.now() },
    ]);
  }

  const canSubmit =
    section !== null &&
    pickedLrns.length > 0 &&
    reason.trim().length > 0 &&
    reason.trim().length <= REASON_MAX &&
    !submitting;

  async function submitRequest() {
    if (!canSubmit || !section || active?.filed) return;
    setSubmitting(true);
    setFlowError(null);
    const sectionLabel = section.name;
    const count = pickedLrns.length;
    let taskId: string | null = null;
    try {
      taskId = dockRef.current.startTask({ kind: "sf10-request", title: "Sending SF10 request", description: `${sectionLabel} · ${count} student${count === 1 ? "" : "s"}`, total: count });
    } catch {
      taskId = null;
    }
    try {
      const data = await createAccessRequest({
        sectionId: section.id,
        reason: reason.trim(),
        studentLrns: pickedLrns,
      });
      markSelfNotified(data.id);
      const picked = sectionStudents.filter((s) => pickedLrns.includes(s.lrn));
      const filedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      pushToActive([
        { id: nextMessageId(), from: "user", text: "Submit SF10 access request", at: Date.now() },
        {
          id: nextMessageId(),
          from: "assistant",
          text: "Request submitted — the records desk will verify the LRNs, then approve or deny.",
          at: Date.now(),
          sf10Detail: {
            section: section.name,
            gradeLevel: section.gradeLevel,
            studentCount: pickedLrns.length,
            studentNames: picked.map((s) => s.name),
            lrns: [...pickedLrns],
            reason: reason.trim(),
            filedOn,
            requestId: data.id,
          },
        },
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...c, title: `${section.name} · SF10 access · Filed`, filed: true } : c
        )
      );
      resetFlowStates();
      if (activeId) {
        setSnaps((prev) => {
          const next = { ...prev };
          delete next[activeId];
          saveSnapshots(next);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-sf10-access"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      try {
        if (taskId) dockRef.current.completeTask(taskId, `${sectionLabel} · ${count} student${count === 1 ? "" : "s"} sent`);
      } catch {
        /* ignore */
      }
      toast.success({
        title: "Request submitted",
        description: "Your advisory LRNs will be matched against filed SF10 records for verification.",
      });
    } catch (err) {
      const message = getErrorMessage(err, "Could not submit your SF10 access request.");
      setFlowError(message);
      try {
        if (taskId) dockRef.current.failTask(taskId, message);
      } catch {
        /* ignore */
      }
      toast.error({ title: "Request failed", description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const needle = studentQ.trim().toLowerCase();
  const studentMatches = useMemo(
    () =>
      sectionStudents
        .map((s) => ({ lrn: s.lrn, name: s.name }))
        .filter(
          (s) =>
            !needle || s.name.toLowerCase().includes(needle) || s.lrn.toLowerCase().includes(needle),
        ),
    [sectionStudents, needle],
  );
  const studentRows = studentMatches.slice(0, 60);

  return {
    sections,
    sectionName: section?.name ?? "",
    gradeLevel: section?.gradeLevel ?? "",
    rosterPending: rosterQuery.isPending,
    phase,
    pickedLrns,
    pickedCount: pickedLrns.length,
    candidateCount: sectionStudents.length,
    studentMatches,
    studentRows,
    studentQ,
    setStudentQ,
    reason,
    canSubmit,
    submitting,
    flowError,
    sectionHasActive: sectionActiveStatus !== null,
    sectionActiveStatus,
    handleSectionPick,
    toggleLrn,
    selectAll,
    clearPicks,
    handleStudentsDone,
    handleReasonSend,
    editReason,
    submitRequest,
    resetFlowStates,
    removeFlowSnapshot,
  };
}
