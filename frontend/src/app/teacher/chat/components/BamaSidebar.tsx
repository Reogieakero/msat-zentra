"use client";

import { useMemo } from "react";
import { FileText, Flag, FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BAMA_CHAT_TYPES,
  type BamaChatType,
  type BamaConversation,
} from "./bama-conversations";
import styles from "./bama-sidebar.module.css";

const TYPE_META: Record<BamaChatType, { icon: typeof Flag; accent: string; path: string }> = {
  "grade-flag": { icon: Flag, accent: "text-rose-500", path: "chat/grade-flag" },
  anecdotal: { icon: FileText, accent: "text-amber-500", path: "chat/anecdotal" },
  "sf10-access": { icon: FolderOpen, accent: "text-blue-500", path: "chat/sf10-access" },
};

function ColumnHead({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={action ? title : `${title}, ${count}`}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {action ??
          (count !== undefined ? (
            <span className="text-xs font-semibold text-muted-foreground">{count}</span>
          ) : null)}
      </span>
    </div>
  );
}
interface BamaSidebarProps {
  conversations: BamaConversation[];
  query: string;
  onQueryChange: (next: string) => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleteRequest: (convo: BamaConversation) => void;
}

export function BamaSidebar({
  conversations,
  query,
  onQueryChange,
  activeId,
  onSelect,
  onNew,
  onDeleteRequest,
}: BamaSidebarProps) {
  const needle = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      BAMA_CHAT_TYPES.filter((t) => t.key !== "grade-flag").map((t) => ({
        ...t,
        items: conversations.filter(
          (c) =>
            c.type === t.key &&
            (!needle ||
              c.title.toLowerCase().includes(needle) ||
              c.messages.some((m) => m.text.toLowerCase().includes(needle)))
        ),
      })),
    [conversations, needle]
  );
  const totalChats = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <aside className={styles.sidebar} aria-label="Chat history">
      <Button type="button" className={styles.newBtn} onClick={onNew}>
        <Plus size={14} aria-hidden />
        New chat
      </Button>
      <div className={styles.searchRow}>
        <Search className={styles.searchIcon} aria-hidden />
        <input
          type="search"
          className={styles.search}
          placeholder="Search chats…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search chats"
        />
      </div>
      {totalChats === 0 || groups.every((g) => g.items.length === 0) ? (
        <div className={styles.emptyWrap}>
          <p className={styles.empty}>
            {totalChats === 0 ? "No chats yet — start one below." : `No chats match “${query.trim()}”.`}
          </p>
        </div>
      ) : (
        <div className={styles.board} tabIndex={0} aria-label="Chats by type">
          {groups.map((g) => {
            if (g.items.length === 0) return null;
            const meta = TYPE_META[g.key];
            const MetaIcon = meta.icon;
            return (
              <section
                key={g.key}
                aria-label={g.label}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
              >
                <ColumnHead
                  icon={<MetaIcon size={14} aria-hidden className={meta.accent} />}
                  title={g.label}
                  count={g.items.length}
                />
                <ul className="flex min-w-0 flex-1 flex-col gap-2">
                  {g.items.map((c) => {
                    const selected = c.id === activeId;
                    const last = c.messages[c.messages.length - 1];
                    return (
                      <li key={c.id} className="flex min-w-0 flex-col">
                        <div
                          className={`flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card ${
                            selected ? "border-primary shadow" : ""
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className="truncate font-mono text-[11px] font-medium text-muted-foreground"
                              title={meta.path}
                            >
                              {meta.path} · {c.messages.length} message
                              {c.messages.length !== 1 ? "s" : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteRequest(c)}
                              aria-label={`Delete ${c.title}`}
                              title="Delete chat"
                              className="flex h-6 w-6 shrink-0 items-center justify-center bg-transparent text-muted-foreground transition-colors outline-none hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                            >
                              <Trash2 size={13} aria-hidden />
                            </button>
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelect(c.id)}
                            aria-pressed={selected}
                            aria-label={`Open ${c.title}`}
                            className="flex min-w-0 flex-col gap-1 text-left"
                          >
                            <span className="truncate text-sm font-semibold leading-snug" title={c.title}>
                              {c.title}
                            </span>
                            {last ? (
                              <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                {last.text}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
