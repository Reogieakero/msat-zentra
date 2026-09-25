"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import {
  createConversation,
  loadBamaStore,
  maxMessageId,
  nextMessageId,
  saveBamaStore,
  syncMessageId,
  titleOf,
  type BamaChatType,
  type BamaConversation,
} from "./bama-conversations";
import { TEXT_QUESTION_LABELS, TEXT_QUESTION_PLACEHOLDERS } from "./bama-flow";
import { useAnecdotalFlow } from "./useAnecdotalFlow";
import { BamaSidebar } from "./BamaSidebar";
import { BamaThread } from "./BamaThread";
import { BamaComposer } from "./BamaComposer";
import { BamaFlowDialogs } from "./BamaFlowDialogs";
import styles from "./bama-chat.module.css";

const TYPE_LABELS: Record<BamaChatType, string> = {
  "grade-flag": "Grade Flag",
  anecdotal: "Anecdotal Record",
};

const GREETINGS: Record<BamaChatType, string> = {
  "grade-flag":
    "Hi, I'm Bama. Tell me about the grade concern and I'll help you put the flag together.",
  anecdotal:
    "Hi, I'm Bama. Tell me what happened and I'll help you write the anecdotal record.\nWhich student is this anecdotal report for? Pick one below.",
};

const FREE_FOLLOWUPS: Record<BamaChatType, string> = {
  "grade-flag":
    "Got it — I've kept that with this chat. Full grade-flag help is still learning, so please raise the actual flag from Grade Flags for now.",
  anecdotal:
    "Noted — I've kept that with this chat. Pick the student above and I'll walk you through the report.",
};

export function BamaChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<BamaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BamaConversation | null>(null);
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const replyTimer = useRef<number | null>(null);

  // Load persisted chats once (client only).
  useEffect(() => {
    const store = loadBamaStore();
    setConversations(store.conversations);
    setActiveId(store.activeId);
    syncMessageId(maxMessageId(store.conversations) + 1);
    setHydrated(true);
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
  }, []);

  // Persist chats on change (after hydration).
  useEffect(() => {
    if (hydrated) saveBamaStore({ conversations, activeId });
  }, [conversations, activeId, hydrated]);

  useEffect(() => {
    return () => {
      if (replyTimer.current !== null) window.clearTimeout(replyTimer.current);
    };
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const anecMode = active?.type === "anecdotal";

  const flow = useAnecdotalFlow({
    active,
    activeId,
    hydrated,
    setConversations,
    draft,
    setDraft,
  });

  // ---- Free chat (grade-flag threads) ----
  function handleFreeSend() {
    const text = draft.trim();
    if (!text || sending) return;
    if (!active) {
      // No open chat — start one and keep the typed message in the box.
      startChat("anecdotal", true);
      composerRef.current?.focus();
      return;
    }
    const now = Date.now();
    const target = active;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === target.id
          ? {
              ...c,
              title: c.messages.length <= 1 ? titleOf(text) : c.title,
              messages: [...c.messages, { id: nextMessageId(), from: "user" as const, text, at: now }],
              updatedAt: now,
            }
          : c
      )
    );
    setDraft("");
    setSending(true);
    replyTimer.current = window.setTimeout(() => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === target.id
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id: nextMessageId(), from: "assistant" as const, text: FREE_FOLLOWUPS[c.type], at: Date.now() },
                ],
                updatedAt: Date.now(),
              }
            : c
        )
      );
      setSending(false);
      composerRef.current?.focus();
    }, 700);
  }

  function handleSend() {
    if (anecMode) flow.handleAnecSend();
    else handleFreeSend();
  }

  function startChat(type: BamaChatType, keepDraft = false) {
    flow.resetFlowStates();
    const now = Date.now();
    const convo: BamaConversation = {
      ...createConversation(type),
      messages: [{ id: nextMessageId(), from: "assistant", text: GREETINGS[type], at: now }],
      updatedAt: now,
    };
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    if (!keepDraft) setDraft("");
    composerRef.current?.focus();
  }

  // Deep link (e.g. "?new" from the repo's New record button): land fresh
  // with no active thread, so the user picks the chat type
  // (grade flag or anecdotal) from the welcome cards first — nothing is
  // auto-created and no greeting is auto-sent.
  const newParamHandled = useRef(false);
  useEffect(() => {
    if (!hydrated || newParamHandled.current) return;
    const t = searchParams.get("new");
    if (t === null) return;
    newParamHandled.current = true;
    flow.resetFlowStates();
    setActiveId(null);
    setDraft("");
    router.replace("/teacher/chat");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hydrated, searchParams, router]);

  // New chat goes back to a fresh start: no active thread, so the user
  // picks grade flag or anecdotal from the welcome cards first.
  function handleNewChat() {
    flow.resetFlowStates();
    setActiveId(null);
    setDraft("");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    flow.removeFlowSnapshot(id);
    setActiveId((prev) => (prev === id ? null : prev));
    setDeleteTarget(null);
  }

  const composerDisabled =
    sending || flow.filing || !active || active?.filed === true || (anecMode && flow.textQuestion === null);
  const composerPlaceholder = !active
    ? "Pick Grade Flag or Anecdotal above to begin"
    : active?.filed
      ? "This record is filed — start a New chat for another report."
      : anecMode
        ? flow.textQuestion
          ? TEXT_QUESTION_PLACEHOLDERS[flow.textQuestion]
          : flow.student
            ? "Answer the questions above — typing unlocks at each description step"
            : "Pick a student to begin"
        : `Ask Bama about this ${TYPE_LABELS[active.type].toLowerCase()}…`;
  const sendDisabled =
    sending ||
    flow.filing ||
    !active ||
    active?.filed === true ||
    (anecMode
      ? flow.textQuestion !== null
        ? !draft.trim() || !flow.student
        : !flow.canFile
      : !draft.trim());

  return (
    <section className={styles.page} aria-label="Chat with Bama">
      <div className={styles.layout}>
        <BamaSidebar
          conversations={conversations}
          query={query}
          onQueryChange={setQuery}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={handleNewChat}
          onDeleteRequest={setDeleteTarget}
        />

        <div className={styles.body}>
          <BamaThread
            active={active}
            sending={sending}
            flow={flow}
            typeLabel={active ? TYPE_LABELS[active.type] : ""}
            threadRef={threadRef}
            onStartChat={startChat}
            onViewRecord={setPreviewRecordId}
          />
          {active && active.filed ? (
            <div className={styles.endedBar}>
              <p className={styles.endedBarText}>This chat has ended.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => startChat(active.type)}>
                Start new chat
              </Button>
            </div>
          ) : (
            <BamaComposer
            draft={draft}
            onDraftChange={setDraft}
            disabled={composerDisabled}
            placeholder={composerPlaceholder}
            inputLabel={anecMode && flow.textQuestion ? TEXT_QUESTION_LABELS[flow.textQuestion] : "Ask Bama"}
            sendDisabled={sendDisabled}
            sendLabel={anecMode && flow.textQuestion === null ? "File record" : "Send message"}
            hint={
              active?.filed
                ? "This record is filed — start a New chat for another report."
                : sending || flow.filing
                  ? "Working on it…"
                  : "Enter to send · Shift + Enter for a new line"
            }
            onSend={handleSend}
            composerRef={composerRef}
            activeId={activeId}
          />
          )}
        </div>
      </div>

      <BamaFlowDialogs flow={flow} active={active} />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  “{deleteTarget.title}” will be permanently removed. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className={styles.btnRed}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OcForm01PreviewDialog recordId={previewRecordId} onClose={() => setPreviewRecordId(null)} />
    </section>
  );
}
