"use client";

import { useMemo } from "react";
import { Search, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BAMA_CHAT_TYPES,
  type BamaConversation,
} from "./bama-conversations";
import styles from "./bama-sidebar.module.css";

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
      BAMA_CHAT_TYPES.map((t) => ({
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
  const totalChats = conversations.length;

  return (
    <aside className={styles.sidebar} aria-label="Chat history">
      <Button type="button" className={styles.newBtn} onClick={onNew}>
        <SquarePen aria-hidden />
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
        <div className={styles.items} tabIndex={0} aria-label="Chats by type">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.key} className={styles.group}>
                <p className={styles.groupLabel}>
                  {g.label}
                  <span className={styles.groupCount}>{g.items.length}</span>
                </p>
                {g.items.map((c) => {
                  const selected = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`${styles.convItem} ${selected ? styles.convSelected : ""}`}
                    >
                      <button
                        type="button"
                        className={styles.convOpen}
                        aria-pressed={selected}
                        onClick={() => onSelect(c.id)}
                        aria-label={`Open ${c.title}`}
                      >
                        <span className={styles.convTitle}>{c.title}</span>
                        <span className={styles.convMeta}>
                          {c.messages.length} message{c.messages.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.convDelete}
                        onClick={() => onDeleteRequest(c)}
                        aria-label={`Delete ${c.title}`}
                        title="Delete chat"
                      >
                        <Trash2 aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </aside>
  );
}
