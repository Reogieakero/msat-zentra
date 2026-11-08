"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  runAutofill,
  useAutofillCandidates,
  useAutofillPreview,
  type AutofillCandidate,
  type AutofillPreview,
} from "@/services/teacher/sf10Autofill.service";
import {
  nextMessageId,
  type BamaConversation,
  type BamaMessage,
} from "./bama-conversations";

interface UseSf10AutofillFlowArgs {
  active: BamaConversation | null;
  activeId: string | null;
  hydrated: boolean;
  setConversations: Dispatch<SetStateAction<BamaConversation[]>>;
}

export type Sf10AutofillPhase = "section" | "students" | "preview";

interface AutofillSnapshot {
  sectionId: string;
  pickedLrns: string[];
  phase: Sf10AutofillPhase;
}

const EMPTY: AutofillSnapshot = { sectionId: "", pickedLrns: [], phase: "section" };
const SNAP_KEY = "zentra.bama.sf10-autofill.v1";
const PHASES: Sf10AutofillPhase[] = ["section", "students", "preview"];

function sanitizeSnapshot(raw: unknown): AutofillSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const phase = PHASES.includes(s.phase as Sf10AutofillPhase)
    ? (s.phase as Sf10AutofillPhase)
    : "section";
  const pickedLrns = Array.isArray(s.pickedLrns)
    ? (s.pickedLrns as unknown[]).filter((l): l is string => typeof l === "string")
    : [];
  return {
    sectionId: typeof s.sectionId === "string" ? s.sectionId : "",
    pickedLrns,
    phase,
  };
}

function loadSnapshots(): Record<string, AutofillSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, AutofillSnapshot> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const snap = sanitizeSnapshot(v);
      if (snap) out[k] = snap;
    }
    return out;
  } catch {
    return {};
  }
}

function saveSnapshots(snaps: Record<string, AutofillSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAP_KEY, JSON.stringify(snaps));
  } catch {
    // Best-effort only; the chat messages remain the source of truth.
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

export interface Sf10AutofillFlow {
  sections: { id: string; name: string; gradeLevel: string }[];
  sectionName: string;
  gradeLevel: string;
  rosterPending: boolean;
  phase: Sf10AutofillPhase;
  candidates: AutofillCandidate[];
  candidateRows: AutofillCandidate[];
  candidateCount: number;
  candidatesPending: boolean;
  candidatesError: boolean;
  studentQ: string;
  setStudentQ: (next: string) => void;
  pickedLrns: string[];
  pickedCount: number;
  readyCount: number;
  toggleLrn: (lrn: string) => void;
  selectAllReady: () => void;
  clearPicks: () => void;
  handleSectionPick: (id: string) => void;
  handleStudentsDone: () => void;
  backToStudents: () => void;
  preview: AutofillPreview | undefined;
  previewPending: boolean;
  previewError: boolean;
  submitting: boolean;
  flowError: string | null;
  canSubmit: boolean;
  submit: () => Promise<void>;
  resetFlowStates: () => void;
  removeFlowSnapshot: (id: string) => void;
}

export function useSf10AutofillFlow({
  active,
  activeId,
  hydrated,
  setConversations,
}: UseSf10AutofillFlowArgs): Sf10AutofillFlow {
  const queryClient = useQueryClient();
  const dock = useDock();
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);

  const [snaps, setSnaps] = useState<Record<string, AutofillSnapshot>>({});
  const [sectionId, setSectionId] = useState("");
  const [pickedLrns, setPickedLrns] = useState<string[]>([]);
  const [phase, setPhase] = useState<Sf10AutofillPhase>("section");
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
    setSectionId(EMPTY.sectionId);
    setPickedLrns(EMPTY.pickedLrns);
    setPhase(EMPTY.phase);
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
    setPhase(snap.phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeId || active?.type !== "sf10-autofill") return;
    const snap: AutofillSnapshot = { sectionId, pickedLrns, phase };
    setSnaps((prev) => {
      const next = { ...prev, [activeId]: snap };
      saveSnapshots(next);
      return next;
    });
  }, [hydrated, activeId, active?.type, sectionId, pickedLrns, phase]);
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

  const candidatesQuery = useAutofillCandidates(
    sectionId,
    hydrated && active?.type === "sf10-autofill",
  );
  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);

  const previewQuery = useAutofillPreview(
    sectionId,
    pickedLrns,
    hydrated && active?.type === "sf10-autofill" && phase === "preview",
  );
  const preview = previewQuery.data;

  function pushToActive(msgs: BamaMessage[]) {
    if (!activeId) return;
    const id = activeId;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, messages: [...c.messages, ...msgs], updatedAt: Date.now() } : c,
      ),
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
        c.id === activeId && c.title === "New chat"
          ? { ...c, title: `${picked.name} · SF10 auto-fill` }
          : c,
      ),
    );
    pushToActive([
      { id: nextMessageId(), from: "user", text: `${picked.name} · ${picked.gradeLevel}`, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Which advisees should I fill? I only write subjects with adviser-approved grades for all terms. Select students, then press Done.",
        at: Date.now(),
      },
    ]);
  }

  // Single-section advisers skip the picker entirely.
  useEffect(() => {
    if (!hydrated || !active || active.type !== "sf10-autofill" || active.filed) return;
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
    const row = candidates.find((c) => c.lrn === lrn);
    if (!row || !row.ready) return;
    setPickedLrns((prev) => (prev.includes(lrn) ? prev.filter((x) => x !== lrn) : [...prev, lrn]));
    setFlowError(null);
  }

  function selectAllReady() {
    if (phase !== "students") return;
    setPickedLrns(candidates.filter((c) => c.ready).map((c) => c.lrn));
    setFlowError(null);
  }

  function clearPicks() {
    if (phase !== "students") return;
    setPickedLrns([]);
    setFlowError(null);
  }

  function handleStudentsDone() {
    if (phase !== "students" || pickedLrns.length === 0) return;
    setPhase("preview");
    setFlowError(null);
    const names = candidates.filter((c) => pickedLrns.includes(c.lrn)).map((c) => c.name);
    const shown = names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4} more` : "");
    pushToActive([
      { id: nextMessageId(), from: "user", text: `${pickedLrns.length} selected: ${shown}`, at: Date.now() },
      {
        id: nextMessageId(),
        from: "assistant",
        text: "Review what will be written, then press Fill SF10.",
        at: Date.now(),
      },
    ]);
  }

  function backToStudents() {
    if (phase !== "preview" || submitting) return;
    setPhase("students");
    setFlowError(null);
  }

  const readyCount = useMemo(
    () => (preview ? preview.students.filter((s) => s.ready).length : 0),
    [preview],
  );
  const canSubmit = !!preview && readyCount > 0 && !submitting && !previewQuery.isPending;

  async function submit() {
    if (!canSubmit || !section || !preview || active?.filed) return;
    setSubmitting(true);
    setFlowError(null);
    const sectionLabel = section.name;
    const count = preview.students.filter((s) => s.ready).length;
    let taskId: string | null = null;
    try {
      taskId = dockRef.current.startTask({
        kind: "sf10-autofill",
        title: "Filling SF10 from grades",
        description: `${sectionLabel} · ${count} student${count === 1 ? "" : "s"}`,
        total: count,
      });
    } catch {
      taskId = null;
    }
    try {
      const data = await runAutofill({ sectionId: section.id, studentLrns: pickedLrns });
      const filedOn = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      pushToActive([
        { id: nextMessageId(), from: "user", text: `Fill SF10 for ${pickedLrns.length} student${pickedLrns.length === 1 ? "" : "s"}`, at: Date.now() },
        {
          id: nextMessageId(),
          from: "assistant",
          text:
            data.updated > 0
              ? "Done — the SF10 records are updated. Every change kept its version history."
              : "I couldn't fill any SF10 record in this run. Check the reasons below.",
          at: Date.now(),
          sf10AutofillDetail: {
            section: preview.section,
            schoolYear: preview.schoolYear.name,
            studentCount: preview.students.length,
            updated: data.updated,
            skipped: data.skipped,
            failed: data.failed,
            filedOn,
            results: data.results.map((r) => ({
              name: r.name,
              status: r.status,
              message: r.message,
            })),
          },
        },
      ]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, title: `${section.name} · SF10 auto-fill · ${filedOn}`, filed: true }
            : c,
        ),
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
      queryClient.invalidateQueries({ queryKey: ["teacher-sf10-autofill"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      try {
        if (taskId) {
          dockRef.current.completeTask(
            taskId,
            `${sectionLabel} · ${data.updated} updated${data.skipped ? ` · ${data.skipped} skipped` : ""}`,
          );
        }
      } catch {
        /* ignore */
      }
      if (data.updated > 0) {
        toast.success({
          title: "SF10 filled",
          description: `${data.updated} record${data.updated === 1 ? "" : "s"} updated from adviser-approved grades.`,
        });
      } else {
        toast.error({
          title: "Nothing filled",
          description: "No advised subject had adviser-approved grades for every term yet.",
        });
      }
    } catch (err) {
      const message = getErrorMessage(err, "Could not fill the SF10 records.");
      setFlowError(message);
      try {
        if (taskId) dockRef.current.failTask(taskId, message);
      } catch {
        /* ignore */
      }
      toast.error({ title: "Auto-fill failed", description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const needle = studentQ.trim().toLowerCase();
  const candidateRows = useMemo(
    () =>
      candidates.filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.lrn.toLowerCase().includes(needle),
      ),
    [candidates, needle],
  );

  return {
    sections,
    sectionName: section?.name ?? "",
    gradeLevel: section?.gradeLevel ?? "",
    rosterPending: rosterQuery.isPending,
    phase,
    candidates,
    candidateRows,
    candidateCount: candidates.length,
    candidatesPending: candidatesQuery.isPending,
    candidatesError: candidatesQuery.isError,
    studentQ,
    setStudentQ,
    pickedLrns,
    pickedCount: pickedLrns.length,
    readyCount,
    toggleLrn,
    selectAllReady,
    clearPicks,
    handleSectionPick,
    handleStudentsDone,
    backToStudents,
    preview,
    previewPending: previewQuery.isPending,
    previewError: previewQuery.isError,
    submitting,
    flowError,
    canSubmit,
    submit,
    resetFlowStates,
    removeFlowSnapshot,
  };
}
