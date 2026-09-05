"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  Folder,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { StoredConversation } from "./anecdotal-conversations";
import styles from "./AnecdotalHistoryMenu.module.css";

interface AnecdotalHistoryMenuProps {
  conversations: StoredConversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function formatConversationDate(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return `Today ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, yyyy");
}

/**
 * Floating menu on the filing chat: previous chat threads (one per filing
 * flow) plus the teacher's record folders, each linking to its dedicated
 * records page.
 */
export function AnecdotalHistoryMenu({
  conversations,
  activeId,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: AnecdotalHistoryMenuProps) {
  const [query, setQuery] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [convDraft, setConvDraft] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      conversations.filter((c) => {
        if (!needle) return true;
        return (
          c.title.toLowerCase().includes(needle) ||
          c.messages.some((m) => m.text.toLowerCase().includes(needle))
        );
      }),
    [conversations, needle]
  );

  function commitConvRename(id: string) {
    const title = convDraft.trim().slice(0, 80);
    if (title) onRename(id, title);
    setEditingConvId(null);
    setConvDraft("");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <p className={styles.panelTitle}>Chat history</p>
        <span className={styles.panelCount}>
          {conversations.length} chat{conversations.length === 1 ? "" : "s"}
        </span>
      </div>

      <Button type="button" className={styles.newBtn} onClick={onNew}>
        <Plus aria-hidden />
        New chat
      </Button>

      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          aria-label="Search chat history"
          className={styles.search}
        />
      </div>

      <div className={styles.listScroll}>
        {visible.length === 0 ? (
          <p className={styles.empty}>
            {needle
              ? `No chats match "${query}".`
              : "No conversations yet — start a new chat."}
          </p>
        ) : (
          <ul className={styles.convList}>
            {visible.map((c) => {
              const isActive = c.id === activeId;
              const editing = editingConvId === c.id;
              return (
                <li
                  key={c.id}
                  className={`${styles.convItem} ${isActive ? styles.convActive : ""}`}
                >
                  {editing ? (
                    <div className={styles.renameRow}>
                      <Input
                        value={convDraft}
                        onChange={(e) => setConvDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitConvRename(c.id);
                          if (e.key === "Escape") setEditingConvId(null);
                        }}
                        aria-label="Rename conversation"
                        className={styles.renameInput}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.miniBtn}
                        onClick={() => commitConvRename(c.id)}
                        aria-label="Save name"
                      >
                        <Check aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.miniBtn}
                        onClick={() => setEditingConvId(null)}
                        aria-label="Cancel rename"
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.convMain}
                        onClick={() => onSelect(c.id)}
                        aria-current={isActive}
                        title={c.title}
                      >
                        <span className={styles.convTitle}>{c.title}</span>
                        <span className={styles.convMeta}>
                          {formatConversationDate(c.updatedAt)} · {c.messages.length}{" "}
                          message{c.messages.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      <div className={styles.convActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={styles.miniBtn}
                          onClick={() => {
                            setEditingConvId(c.id);
                            setConvDraft(c.title);
                          }}
                          aria-label={`Rename "${c.title}"`}
                          title="Rename"
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`${styles.miniBtn} ${styles.dangerBtn}`}
                          onClick={() => onDelete(c.id)}
                          aria-label={`Delete "${c.title}"`}
                          title="Delete chat"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.foldersBlock}>
        <span className={styles.sectionLabel}>Folders</span>
        <Link href="/teacher/anecdotal/folders" className={styles.browseLink}>
          <Folder className={styles.folderIcon} aria-hidden />
          <span className={styles.browseText}>Browse record folders</span>
        </Link>
        <p className={styles.folderHint}>
          One folder per student, created automatically from filed records.
        </p>
      </div>
    </div>
  );
}
