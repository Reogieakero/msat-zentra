import type { ChatMessage } from "./anecdotal-data";

/**
 * Multi-conversation history for the anecdotal filing chat. Every new
 * anecdotal entry is filed inside its own conversation; past engine/teacher
 * exchanges are kept per conversation and can be grouped into folders.
 * Persisted in localStorage (UI sessions only — filed records live in the
 * database, so history is a convenience layer, never a source of truth).
 */

export const CONVERSATIONS_KEY = "zentra.anecdotal.conversations.v1";
const LEGACY_KEY = "zentra.anecdotal.chat";

export const NEW_CONVERSATION_TITLE = "New conversation";

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ConversationStore {
  conversations: StoredConversation[];
  activeId: string | null;
}

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function createConversation(title = NEW_CONVERSATION_TITLE): StoredConversation {
  const now = Date.now();
  return {
    id: makeId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function isValidMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const msg = m as Record<string, unknown>;
  if (typeof msg.text !== "string") return false;
  if (msg.from !== "assistant" && msg.from !== "user") return false;
  const detail = msg.detail as { studentName?: unknown; incident?: unknown } | undefined;
  if (
    detail !== undefined &&
    (typeof detail.studentName !== "string" || typeof detail.incident !== "string")
  ) {
    return false;
  }
  return true;
}

function sanitizeConversation(raw: unknown): StoredConversation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id) return null;
  const messages = Array.isArray(c.messages)
    ? (c.messages as unknown[]).filter(isValidMessage).slice(-MAX_MESSAGES_PER_CONVERSATION)
    : [];
  return {
    id: c.id,
    title: typeof c.title === "string" && c.title.trim() ? c.title : NEW_CONVERSATION_TITLE,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now(),
    messages,
  };
}

function readLegacyMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter(isValidMessage);
  } catch {
    return [];
  }
}

export function loadConversationStore(): ConversationStore {
  const empty: ConversationStore = { conversations: [], activeId: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        conversations?: unknown[];
        activeId?: unknown;
      };
      const conversations = Array.isArray(parsed.conversations)
        ? parsed.conversations
            .map(sanitizeConversation)
            .filter((c): c is StoredConversation => c !== null)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_CONVERSATIONS)
        : [];
      const activeId =
        typeof parsed.activeId === "string" &&
        conversations.some((c) => c.id === parsed.activeId)
          ? parsed.activeId
          : (conversations[0]?.id ?? null);
      return { conversations, activeId };
    }
  } catch {
    // Corrupt store — fall through to legacy migration / fresh start.
  }
  // One-time migration of the old single-thread history.
  const legacy = readLegacyMessages();
  if (legacy.length > 0) {
    const now = Date.now();
    const migrated: StoredConversation = {
      id: makeId(),
      title: "Previous chats",
      createdAt: now,
      updatedAt: now,
      messages: legacy.slice(-MAX_MESSAGES_PER_CONVERSATION),
    };
    const store: ConversationStore = {
      conversations: [migrated],
      activeId: migrated.id,
    };
    try {
      window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(store));
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Storage unavailable — history simply won't persist.
    }
    return store;
  }
  return empty;
}

export function saveConversationStore(store: ConversationStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify({
        ...store,
        conversations: [...store.conversations]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_CONVERSATIONS)
          .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION) })),
      })
    );
  } catch {
    // Storage full or unavailable — history simply won't persist.
  }
}

/** Largest persisted message id, so fresh ids never collide after reload. */
export function maxMessageId(conversations: StoredConversation[]): number {
  let max = 0;
  for (const c of conversations) {
    for (const m of c.messages) {
      if (typeof m.id === "number" && m.id > max) max = m.id;
    }
  }
  return max;
}
