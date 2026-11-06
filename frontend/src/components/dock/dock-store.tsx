"use client";

import * as React from "react";
import { getAccessToken } from "@/lib/api/client";
import type { DockTask, DockTaskKind, DockTaskStatus } from "./dock-types";

const STORAGE_KEY = "zentra.dock.tasks.v1";
const CHANNEL_NAME = "zentra-dock-v1";
const TAB_ID_KEY = "zentra.dock.tabId";
const MAX_TASKS = 20;

interface PersistedDockState {
  userId: string | null;
  tasks: DockTask[];
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `dock-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getTabId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const id = newId();
    window.sessionStorage.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    return `mem-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

function getUserId(): string | null {
  try {
    const token = getAccessToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function loadPersisted(): PersistedDockState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDockState;
    if (!parsed || !Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isTerminal(status: DockTaskStatus): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

function sameTasks(a: DockTask[], b: DockTask[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.kind !== y.kind ||
      x.title !== y.title ||
      x.description !== y.description ||
      x.status !== y.status ||
      (x.progress?.done ?? -1) !== (y.progress?.done ?? -1) ||
      (x.progress?.total ?? -1) !== (y.progress?.total ?? -1) ||
      (x.error ?? null) !== (y.error ?? null) ||
      x.createdAt !== y.createdAt ||
      x.updatedAt !== y.updatedAt ||
      (x.ownerTabId ?? null) !== (y.ownerTabId ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function serializeDock(userId: string | null, tasks: DockTask[]): string {
  return JSON.stringify({ userId, tasks: tasks.slice(0, MAX_TASKS) });
}

interface StartTaskInput {
  kind: DockTaskKind;
  title: string;
  description: string;
  total?: number;
}

interface DockStoreValue {
  tasks: DockTask[];
  startTask: (input: StartTaskInput) => string;
  updateTask: (id: string, patch: Partial<Pick<DockTask, "title" | "description" | "status" | "progress" | "error">>) => void;
  completeTask: (id: string, description?: string) => void;
  failTask: (id: string, message: string) => void;
  cancelTask: (id: string) => void;
  dismissTask: (id: string) => void;
  dismissAllCompleted: () => void;
}

const DockStoreContext = React.createContext<DockStoreValue | null>(null);

export function useDock(): DockStoreValue {
  const ctx = React.useContext(DockStoreContext);
  if (!ctx) throw new Error("useDock must be used inside DockProvider");
  return ctx;
}

/**
 * Single shared task holder for the bottom-right Dock.
 * - Lives at the app root so page jumps keep tasks alive.
 * - Saves tasks in browser saved memory so refresh brings them back.
 * - Talks between tabs so a second tab shows the same list.
 * - A task running in this tab before a refresh is marked failed
 *   with plain words, since the network request died with the page.
 *   Files themselves are never saved, only names and counts.
 */
export function DockProvider({ children }: { children: React.ReactNode }) {
  const tabIdRef = React.useRef<string>("server");
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  // Set when applying a remote list: the next save writes to saved memory
  // but must NOT echo back over the channel (that echo is the ping-pong
  // loop that froze the Dock). Consumed by the save effect, never timers.
  const suppressBroadcastRef = React.useRef(false);
  // Payload of the last save/write, so identical states never rewrite or
  // rebroadcast (each rewrite would wake the other tabs again).
  const lastSavedRef = React.useRef<string | null>(null);
  // First save after loading: write back only when the load changed
  // something (refresh-marked failures), and never broadcast — the other
  // tabs learn through saved memory, and a fresh empty tab must never
  // wipe live tasks off the channel.
  const initialWriteRef = React.useRef<{ payload: string; dirty: boolean } | null>(null);
  const [userId, setUserId] = React.useState<string | null>(() => getUserId());
  const [tasks, setTasks] = React.useState<DockTask[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const tasksRef = React.useRef<DockTask[]>([]);
  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // One-time load: tab id, saved tasks.
  React.useEffect(() => {
    const tabId = getTabId();
    tabIdRef.current = tabId;
    const uid = getUserId();
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    const saved = loadPersisted();
    let revived: DockTask[] = [];
    if (saved && (saved.userId === uid || saved.userId === null || uid === null)) {
      const now = Date.now();
      revived = saved.tasks.slice(0, MAX_TASKS).map((t) => {
        // This tab reloaded while it owned a running task: the request
        // died with the page, so say so in plain words.
        if ((t.status === "running" || t.status === "waiting") && t.ownerTabId === tabId) {
          return {
            ...t,
            status: "failed" as const,
            error: "Stopped because the page was refreshed. Please try again.",
            updatedAt: now,
          };
        }
        return t;
      });
    }
    const payload = serializeDock(uid, revived);
    initialWriteRef.current = { payload, dirty: raw !== payload };
    lastSavedRef.current = payload;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time rehydrate from browser saved memory
    setTasks(revived);
    setHydrated(true);
  }, []);

  // Cross-tab channel.
  React.useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; userId?: string | null; tasks?: DockTask[] } | null;
      if (!msg || msg.type !== "sync" || !Array.isArray(msg.tasks)) return;
      const currentUid = getUserId();
      if (msg.userId !== currentUid) return;
      const incoming = msg.tasks.slice(0, MAX_TASKS);
      // Identical list: ignore, or the two tabs will echo forever.
      if (sameTasks(tasksRef.current, incoming)) return;
      suppressBroadcastRef.current = true;
      try {
        lastSavedRef.current = serializeDock(currentUid, incoming);
      } catch {
        /* ignore */
      }
      setTasks(incoming);
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  // Also listen to storage events (fallback when BroadcastChannel is missing).
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as PersistedDockState;
        const currentUid = getUserId();
        if (parsed.userId !== currentUid || !Array.isArray(parsed.tasks)) return;
        const incoming = parsed.tasks.slice(0, MAX_TASKS);
        if (sameTasks(tasksRef.current, incoming)) return;
        suppressBroadcastRef.current = true;
        try {
          lastSavedRef.current = serializeDock(currentUid, incoming);
        } catch {
          /* ignore */
        }
        setTasks(incoming);
      } catch {
        /* keep current list */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Save + broadcast on change (after first load).
  React.useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const uid = getUserId();
    const snapshot = tasks.slice(0, MAX_TASKS);
    const payload = serializeDock(uid, snapshot);
    const initial = initialWriteRef.current;
    if (initial) {
      initialWriteRef.current = null;
      suppressBroadcastRef.current = false;
      if (!initial.dirty) return;
      // The load changed something (failures marked after a refresh):
      // save it so other tabs learn through saved memory, but never
      // broadcast — a fresh tab must never wipe live tasks.
      lastSavedRef.current = payload;
      try {
        window.localStorage.setItem(STORAGE_KEY, payload);
      } catch {
        /* private mode — keep in-memory only */
      }
      return;
    }
    if (payload === lastSavedRef.current) {
      suppressBroadcastRef.current = false;
      return;
    }
    lastSavedRef.current = payload;
    try {
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      /* private mode — keep in-memory only */
    }
    // A list applied from another tab must not echo back.
    if (suppressBroadcastRef.current) {
      suppressBroadcastRef.current = false;
      return;
    }
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: "sync", userId: uid, tasks: snapshot });
      } catch {
        /* ignore */
      }
    }
  }, [tasks, hydrated]);

  // Heartbeat: owned running tasks stay fresh so other tabs know they are live.
  // Backstop: a running task owned by another tab and silent for over two
  // minutes means its tab died without saying goodbye — fail it plainly
  // instead of spinning forever.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const tabId = tabIdRef.current;
      const now = Date.now();
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.status === "running" && t.ownerTabId === tabId) {
            if (t.updatedAt > now - 4000) return t;
            changed = true;
            return { ...t, updatedAt: now };
          }
          if (t.status === "running" && t.ownerTabId !== tabId && now - t.updatedAt > 120_000) {
            changed = true;
            return {
              ...t,
              status: "failed" as const,
              error: "Stopped — its tab may have closed. Please check or try again.",
              updatedAt: now,
            };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // Tab closing or refreshing: leave honest failure markings in saved memory
  // so other open tabs pick them up at once through the storage event.
  React.useEffect(() => {
    const onHide = () => {
      try {
        const tabId = tabIdRef.current;
        const current = tasksRef.current;
        if (!current.some((t) => (t.status === "running" || t.status === "waiting") && t.ownerTabId === tabId)) return;
        const now = Date.now();
        const next: DockTask[] = current.map((t) =>
          (t.status === "running" || t.status === "waiting") && t.ownerTabId === tabId
            ? { ...t, status: "failed" as const, error: "Stopped because its tab closed. Please try again.", updatedAt: now }
            : t,
        );
        window.localStorage.setItem(STORAGE_KEY, serializeDock(getUserId(), next));
      } catch {
        /* page is going away — best effort only */
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const startTask = React.useCallback((input: StartTaskInput): string => {
    const now = Date.now();
    const id = newId();
    const task: DockTask = {
      id,
      kind: input.kind,
      title: input.title,
      description: input.description,
      status: "running",
      progress: typeof input.total === "number" ? { done: 0, total: input.total } : null,
      error: null,
      createdAt: now,
      updatedAt: now,
      ownerTabId: tabIdRef.current,
    };
    setTasks((prev) => [task, ...prev].slice(0, MAX_TASKS));
    return id;
  }, []);

  const updateTask = React.useCallback(
    (id: string, patch: Partial<Pick<DockTask, "title" | "description" | "status" | "progress" | "error">>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
      );
    },
    [],
  );

  const completeTask = React.useCallback((id: string, description?: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "done" as const, error: null, description: description ?? t.description, progress: t.progress ? { done: t.progress.total, total: t.progress.total } : t.progress, updatedAt: Date.now() }
          : t,
      ),
    );
  }, []);

  const failTask = React.useCallback((id: string, message: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "failed" as const, error: message, updatedAt: Date.now() } : t)),
    );
  }, []);

  const cancelTask = React.useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (isTerminal(t.status)) return t;
        return { ...t, status: "cancelled" as const, updatedAt: Date.now() };
      }),
    );
  }, []);

  const dismissTask = React.useCallback((id: string) => {
    setTasks((prev) => {
      const found = prev.find((t) => t.id === id);
      if (!found || !isTerminal(found.status)) return prev;
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const dismissAllCompleted = React.useCallback(() => {
    setTasks((prev) => {
      if (prev.some((t) => t.status === "running")) return prev;
      return prev.filter((t) => !isTerminal(t.status));
    });
  }, []);

  const value = React.useMemo<DockStoreValue>(
    () => ({ tasks, startTask, updateTask, completeTask, failTask, cancelTask, dismissTask, dismissAllCompleted }),
    [tasks, startTask, updateTask, completeTask, failTask, cancelTask, dismissTask, dismissAllCompleted],
  );

  // Keep user id fresh (login change without reload is rare, but cheap).
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setUserId((prev) => {
        const next = getUserId();
        return prev === next ? prev : next;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  void userId;

  return <DockStoreContext.Provider value={value}>{children}</DockStoreContext.Provider>;
}
