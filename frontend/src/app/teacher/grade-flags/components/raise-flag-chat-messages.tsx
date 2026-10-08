"use client";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "./raise-flag-chat-storage";
import styles from "./RaiseFlagChat.module.css";
export function RaiseFlagMessages({ messages }: { messages: ChatMessage[] }) {
  return (
    <>
      {messages.map((m) =>
        m.from === "assistant" ? (
          <div key={m.id} className={styles.rowAssistant}>
            <span className={styles.botAvatar} aria-hidden>
              <Bot className={styles.botIcon} />
            </span>
            {m.detail ? (
              <div className={styles.detailWrap}>
                <div className={styles.detailCard}>
                  <div className={styles.detailHead}>
                    <p className={styles.detailTitle}>{m.detail.studentName}</p>
                    <Badge variant="amber">Open</Badge>
                  </div>
                  <p className={styles.detailSub}>
                    {m.detail.lrn} · {m.detail.subject} · {m.detail.section} · Term{" "}
                    {m.detail.termNumber}
                  </p>
                  <div className={styles.detailReasonRow}>
                    <Badge variant="outline">{m.detail.reasonLabel}</Badge>
                    <span className={styles.detailFiledOn}>{m.detail.filedOn}</span>
                  </div>
                  <p className={styles.detailNote}>&ldquo;{m.detail.note}&rdquo;</p>
                  <dl className={styles.detailMeta}>
                    <div className={styles.detailMetaRow}>
                      <dt>Gradebook owner</dt>
                      <dd>{m.detail.owner}</dd>
                    </div>
                    <div className={styles.detailMetaRow}>
                      <dt>Status</dt>
                      <dd>Open · waiting on owner</dd>
                    </div>
                  </dl>
                </div>
                <hr className={styles.endMark} aria-hidden />
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
    </>
  );
}
