/**
 * Bama chat history. Conversations are grouped by helper type (grade flag
 * or anecdotal record) and persist in localStorage — UI sessions only,
 * never a source of truth.
 */

export type BamaChatType = "grade-flag" | "anecdotal";

export const BAMA_CHAT_TYPES: { key: BamaChatType; label: string }[] = [
  { key: "grade-flag", label: "Grade Flag" },
  { key: "anecdotal", label: "Anecdotal Record" },
];

export interface BamaMessage {
  id: number;
  from: "assistant" | "user";
  text: string;
  at: number;
  // Guided-flow widgets (anecdotal chats): pickers, option buttons,
  // date picker, review card, filed card. Plain data only — persisted.
  question?: {
    type: "student" | "class" | "category" | "tier" | "datetime";
    options: { value: string; label: string }[];
    locked?: boolean;
  };
  preview?: BamaRecordCard;
  detail?: BamaRecordCard & { recordId: string };
}

export interface BamaRecordCard {
  studentName: string;
  lrn: string;
  section: string;
  category: string;
  tier: string;
  location: string;
  incident: string;
  notes: string;
  classPerformance: string;
  attendanceSummary: string;
  observationDateTime: string;
  filedOn: string;
}

export interface BamaConversation {
  id: string;
  title: string;
  type: BamaChatType;
  createdAt: number;
  updatedAt: number;
  messages: BamaMessage[];
  /** Set once its anecdotal record is filed — the thread becomes read-only. */
  filed?: boolean;
}

export interface BamaStore {
  conversations: BamaConversation[];
  activeId: string | null;
}

const STORE_KEY = "zentra.bama.conversations.v1";
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 200;

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function createConversation(type: BamaChatType, title = "New chat"): BamaConversation {
  const now = Date.now();
  return { id: makeId(), title, type, createdAt: now, updatedAt: now, messages: [] };
}

function isValidType(value: unknown): value is BamaChatType {
  return value === "grade-flag" || value === "anecdotal";
}

function isValidMessage(m: unknown): m is BamaMessage {
  if (!m || typeof m !== "object") return false;
  const msg = m as Record<string, unknown>;
  return (
    typeof msg.id === "number" &&
    (msg.from === "assistant" || msg.from === "user") &&
    typeof msg.text === "string" &&
    typeof msg.at === "number"
  );
}

function sanitize(raw: unknown): BamaConversation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id) return null;
  if (!isValidType(c.type)) return null;
  const messages = Array.isArray(c.messages)
    ? (c.messages as unknown[]).filter(isValidMessage).slice(-MAX_MESSAGES)
    : [];
  return {
    id: c.id,
    title: typeof c.title === "string" && c.title.trim() ? c.title : "New chat",
    type: c.type,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now(),
    messages,
    filed: c.filed === true,
  };
}

export function loadBamaStore(): BamaStore {
  const empty: BamaStore = { conversations: [], activeId: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as { conversations?: unknown[]; activeId?: unknown };
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
          .map(sanitize)
          .filter((c): c is BamaConversation => c !== null)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_CONVERSATIONS)
      : [];
    const activeId =
      typeof parsed.activeId === "string" && conversations.some((c) => c.id === parsed.activeId)
        ? parsed.activeId
        : (conversations[0]?.id ?? null);
    return { conversations, activeId };
  } catch {
    return empty;
  }
}

export function saveBamaStore(store: BamaStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        ...store,
        conversations: [...store.conversations]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_CONVERSATIONS)
          .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES) })),
      })
    );
  } catch {
    // Storage unavailable — history simply won't persist.
  }
}

export function maxMessageId(conversations: BamaConversation[]): number {
  let max = 0;
  for (const c of conversations) {
    for (const m of c.messages) {
      if (m.id > max) max = m.id;
    }
  }
  return max;
}

let messageId = Date.now();

/** Next unique chat message id (module-scoped so dialogs + thread agree). */
export function nextMessageId(): number {
  return messageId++;
}

/** Reseed the id counter (e.g. after loading persisted chats). */
export function syncMessageId(n: number): void {
  messageId = Math.max(messageId, n);
}

export function titleOf(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t || "New chat";
}
