"use client";

import { useEffect, type RefObject } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import styles from "./bama-composer.module.css";

interface BamaComposerProps {
  draft: string;
  onDraftChange: (next: string) => void;
  disabled: boolean;
  placeholder: string;
  inputLabel: string;
  sendDisabled: boolean;
  sendLabel: string;
  hint: string;
  onSend: () => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  activeId: string | null;
}

export function BamaComposer({
  draft,
  onDraftChange,
  disabled,
  placeholder,
  inputLabel,
  sendDisabled,
  sendLabel,
  hint,
  onSend,
  composerRef,
  activeId,
}: BamaComposerProps) {
  // Auto-extend the ask box with its content instead of scrolling it.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [draft, activeId, composerRef]);

  return (
    <div className={styles.composer}>
      <div className={styles.askWrap}>
        <Textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={placeholder}
          aria-label={inputLabel}
          rows={3}
          maxLength={2000}
          className={styles.ask}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={disabled}
        />
        <Button
          type="button"
          size="icon"
          className={styles.sendInside}
          disabled={sendDisabled}
          onClick={onSend}
          aria-label={sendLabel}
        >
          <ArrowUp aria-hidden />
        </Button>
      </div>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
