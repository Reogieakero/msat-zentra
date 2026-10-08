"use client";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/services/anecdotal/anecdotal.types";
import {
  createConversation,
  loadConversationStore,
  maxMessageId,
  saveConversationStore,
  type StoredConversation,
} from "./anecdotal-conversations";
let messageId = Date.now();
export function nextAnecdotalMessageId(): number {
  return messageId++;
}
export function syncAnecdotalMessageId(conversations: StoredConversation[]): void {
  messageId = Math.max(Date.now(), maxMessageId(conversations) + 1);
}
export interface AnecdotalConversations {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversations: StoredConversation[];
  setConversations: React.Dispatch<React.SetStateAction<StoredConversation[]>>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  hydrated: boolean;
  historyOpen: boolean;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeConversation: StoredConversation | null;
  startNewChat: (resetFlow: () => void) => void;
  switchConversation: (id: string, resetFlow: () => void) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string, resetFlow: () => void) => void;
}
export function useAnecdotalConversations(): AnecdotalConversations {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const store = loadConversationStore();
    syncAnecdotalMessageId(store.conversations);
    if (store.conversations.length === 0) {
      const first = createConversation();
      setConversations([first]);
      setActiveId(first.id);
      setMessages([]);
    } else {
      const active =
        store.conversations.find((c) => c.id === store.activeId) ??
        store.conversations[0];
      setConversations(store.conversations);
      setActiveId(active.id);
      setMessages(active.messages);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated || !activeId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages, updatedAt: Date.now() } : c
      )
    );
  }, [messages, hydrated, activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return;
    saveConversationStore({ conversations, activeId });
  }, [conversations, activeId, hydrated]);
  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;
  function startNewChat(resetFlow: () => void) {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    resetFlow();
    setHistoryOpen(false);
  }
  function switchConversation(id: string, resetFlow: () => void) {
    if (id === activeId) {
      setHistoryOpen(false);
      return;
    }
    const target = conversations.find((c) => c.id === id);
    if (!target) return;
    setActiveId(id);
    setMessages(target.messages);
    resetFlow();
    setHistoryOpen(false);
  }
  function renameConversation(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
    );
  }
  function deleteConversation(id: string, resetFlow: () => void) {
    const remaining = conversations.filter((c) => c.id !== id);
    if (id !== activeId) {
      setConversations(remaining);
      return;
    }
    if (remaining.length === 0) {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      setMessages([]);
    } else {
      const next =
        [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setConversations(remaining);
      setActiveId(next.id);
      setMessages(next.messages);
    }
    resetFlow();
  }
  return {
    messages,
    setMessages,
    conversations,
    setConversations,
    activeId,
    setActiveId,
    hydrated,
    historyOpen,
    setHistoryOpen,
    activeConversation,
    startNewChat,
    switchConversation,
    renameConversation,
    deleteConversation,
  };
}
