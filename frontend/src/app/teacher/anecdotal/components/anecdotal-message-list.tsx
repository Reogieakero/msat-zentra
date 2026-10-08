"use client";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/services/anecdotal/anecdotal.types";
import { FiledDetailCard, PreviewDetailCard } from "./AnecdotalDetailCards";
import { AnecdotalDatetimeQuestion } from "./anecdotal-datetime-question";
import styles from "./AnecdotalChat.module.css";
interface Props {
  messages: ChatMessage[];
  messagesRef: React.RefObject<HTMLDivElement | null>;
  downloadingId: string | null;
  onPreview: (recordId: string) => void;
  onDownload: (recordId: string) => void;
  questionSelectedValue: (type: string) => string | null;
  onQuestionOptionClick: (type: string, value: string) => void;
  datetimeDateInput: string;
  setDatetimeDateInput: (v: string) => void;
  datetimeTimeInput: string;
  setDatetimeTimeInput: (v: string) => void;
  datetimePopoverOpen: boolean;
  setDatetimePopoverOpen: (v: boolean) => void;
  onDatetimeConfirm: () => void;
}
export function AnecdotalMessageList({
  messages,
  messagesRef,
  downloadingId,
  onPreview,
  onDownload,
  questionSelectedValue,
  onQuestionOptionClick,
  datetimeDateInput,
  setDatetimeDateInput,
  datetimeTimeInput,
  setDatetimeTimeInput,
  datetimePopoverOpen,
  setDatetimePopoverOpen,
  onDatetimeConfirm,
}: Props) {
  return (
    <div className={styles.messages} aria-live="polite" ref={messagesRef}>
      {messages.map((m) =>
        m.from === "assistant" ? (
          <div key={m.id} className={styles.rowAssistant}>
            <span className={styles.botAvatar} aria-hidden>
              <Bot className={styles.botIcon} />
            </span>
            {m.detail ? (
              <FiledDetailCard
                detail={m.detail}
                downloadingId={downloadingId}
                onPreview={(recordId) => onPreview(recordId)}
                onDownload={(recordId) => onDownload(recordId)}
              />
            ) : m.preview ? (
              <PreviewDetailCard preview={m.preview} />
            ) : m.question ? (
              <div className={styles.questionBubble}>
                <p className={styles.questionText}>{m.text}</p>
                {m.question.type === "datetime" ? (
                  <AnecdotalDatetimeQuestion
                    locked={m.question.locked ?? false}
                    dateInput={datetimeDateInput}
                    setDateInput={setDatetimeDateInput}
                    timeInput={datetimeTimeInput}
                    setTimeInput={setDatetimeTimeInput}
                    popoverOpen={datetimePopoverOpen}
                    setPopoverOpen={setDatetimePopoverOpen}
                    onConfirm={onDatetimeConfirm}
                  />
                ) : (
                  <div className={styles.suggestions}>
                    {m.question.options.map((opt) => {
                      const isSelected =
                        questionSelectedValue(m.question!.type) === opt.value;
                      const isLocked = m.question!.locked ?? false;
                      return (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={styles.suggestion}
                          disabled={isLocked}
                          onClick={() =>
                            onQuestionOptionClick(m.question!.type, opt.value)
                          }
                          aria-pressed={isSelected}
                          aria-disabled={isLocked}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className={styles.bubbleAssistant}>{m.text}</p>
            )}
          </div>
        ) : (
          <div key={m.id} className={styles.rowUser}>
            <p className={styles.bubbleUser}>{m.text}</p>
          </div>
        )
      )}
    </div>
  );
}
