"use client";

import { useEffect, type RefObject } from "react";
import { Cat, Check, FilePenLine, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import type { BamaChatType, BamaConversation } from "./bama-conversations";
import { CATEGORY_TONES } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import styles from "./bama-thread.module.css";

interface BamaThreadProps {
  active: BamaConversation | null;
  sending: boolean;
  flow: AnecdotalFlow;
  typeLabel: string;
  threadRef: RefObject<HTMLDivElement | null>;
  onStartChat: (type: BamaChatType) => void;
  onViewRecord: (recordId: string) => void;
}

export function BamaThread({
  active,
  sending,
  flow,
  typeLabel,
  threadRef,
  onStartChat,
  onViewRecord,
}: BamaThreadProps) {
  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, active?.id, sending, threadRef]);

  if (!active) {
    return (
      <div className={styles.welcome}>
        <span className={styles.welcomeAvatar} aria-hidden>
          <Cat />
        </span>
        <h1 className={styles.welcomeTitle}>Chat with Bama</h1>
        <p className={styles.welcomeBody}>
          Pick what you need help with — your chats are grouped by type on the left.
        </p>
        <div className={styles.typeGrid}>
          <button type="button" className={styles.typeCard} onClick={() => onStartChat("grade-flag")}>
            <Flag aria-hidden />
            <span className={styles.typeName}>Grade Flag</span>
            <span className={styles.typeSub}>Raise a grade concern</span>
          </button>
          <button type="button" className={styles.typeCard} onClick={() => onStartChat("anecdotal")}>
            <FilePenLine aria-hidden />
            <span className={styles.typeName}>Anecdotal Record</span>
            <span className={styles.typeSub}>Write an incident report</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.threadHead}>
        <p className={styles.threadTitle}>{active.title}</p>
        <Badge variant="secondary">{typeLabel}</Badge>
      </div>
      <div ref={threadRef} className={styles.thread} aria-live="polite" aria-label="Messages">
        {active.messages.map((m) =>
          m.from === "assistant" ? (
            <div key={m.id} className={styles.rowAssistant}>
              <span className={styles.avatar} aria-hidden>
                <Cat />
              </span>
              <div className={styles.assistantCol}>
                <p className={styles.bubbleAssistant}>{m.text}</p>
                {m.preview ? (
                  <div className={styles.reviewCard}>
                    <p className={styles.reviewHead}>Review before filing</p>
                    <dl className={styles.reviewRows}>
                      <div><dt>Student</dt><dd>{m.preview.studentName} · {m.preview.lrn}</dd></div>
                      <div><dt>Section</dt><dd>{m.preview.section}</dd></div>
                      <div><dt>Category</dt><dd>{m.preview.category}</dd></div>
                      <div><dt>Confidentiality</dt><dd>{m.preview.tier}</dd></div>
                      <div><dt>Observed</dt><dd>{m.preview.observationDateTime}</dd></div>
                      <div><dt>Location</dt><dd>{m.preview.location}</dd></div>
                      <div><dt>Incident</dt><dd>{m.preview.incident}</dd></div>
                      {m.preview.notes ? <div><dt>Notes</dt><dd>{m.preview.notes}</dd></div> : null}
                    </dl>
                    <Button
                      type="button"
                      className={styles.fileBtn}
                      disabled={flow.filing || !flow.canFile}
                      onClick={() => flow.setConfirmFiling(true)}
                    >
                      File record
                    </Button>
                  </div>
                ) : null}
                        {m.detail ? (
                          <div className={styles.filedCard}>
                            <button
                              type="button"
                              className={`${styles.folderDrop} ${styles.folderButton}`}
                              onClick={() => onViewRecord(m.detail!.recordId)}
                              aria-label={`Open ${m.detail.studentName}'s anecdotal record`}
                            >
                              <FolderCard
                                label={m.detail.studentName}
                                sublabel={`${m.detail.category} · ${m.detail.observationDateTime}`}
                                files={[
                                  {
                                    name: "GCForm-01",
                                    tag: m.detail.category,
                                    tone: CATEGORY_TONES[m.detail.category.toLowerCase()] ?? 1,
                                    icon: "doc",
                                  },
                                ]}
                              />
                            </button>
                            <p className={styles.filedHead}>
                              <Check aria-hidden /> Filed · {m.detail.category} · {m.detail.observationDateTime}
                            </p>
                            <p className={styles.filedText}>{m.detail.incident}</p>
                          </div>
                        ) : null}
              </div>
            </div>
          ) : (
            <div key={m.id} className={styles.rowUser}>
              <p className={styles.bubbleUser}>{m.text}</p>
            </div>
          )
        )}
        {sending ? (
          <div className={styles.rowAssistant} aria-label="Bama is typing">
            <span className={styles.avatar} aria-hidden>
              <Cat />
            </span>
            <p className={styles.bubbleAssistant}>
              <span className={styles.typing} aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </p>
          </div>
        ) : null}
        {active.type === "anecdotal" && !active.filed && flow.studentId === "" ? (
          <p className={styles.threadHint}>Pick a student to begin — the picker stays open until you choose.</p>
        ) : null}
        {flow.flowError ? <p className={styles.flowError}>{flow.flowError}</p> : null}
      </div>
    </>
  );
}
