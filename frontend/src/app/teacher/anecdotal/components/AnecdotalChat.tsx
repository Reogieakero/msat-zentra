"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { Folder, History, Plus } from "lucide-react";
import { NEW_CONVERSATION_TITLE } from "./anecdotal-conversations";
import { AnecdotalHistoryMenu } from "./AnecdotalHistoryMenu";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { useAnecdotalConversations } from "./use-anecdotal-conversations";
import { useAnecdotalChatFlow } from "./use-anecdotal-chat-flow";
import { AnecdotalMessageList } from "./anecdotal-message-list";
import { AnecdotalChatComposer } from "./anecdotal-chat-composer";
import styles from "./AnecdotalChat.module.css";
export function AnecdotalChat() {
  const router = useRouter();
  const conv = useAnecdotalConversations();
  const flow = useAnecdotalChatFlow({
    messages: conv.messages,
    setMessages: conv.setMessages,
    conversations: conv.conversations,
    setConversations: conv.setConversations,
    activeId: conv.activeId,
    hydrated: conv.hydrated,
  });
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv.messages, flow.studentId, flow.gcformKnown, flow.category, flow.tier, flow.textQuestion]);
  function handleNew() {
    conv.startNewChat(flow.resetFlow);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  return (
    <div className={styles.chat}>
      <div className={styles.chatBody}>
        <div className={styles.topBar}>
          <p className={styles.convTitle} title={conv.activeConversation?.title ?? NEW_CONVERSATION_TITLE}>
            {conv.activeConversation?.title ?? NEW_CONVERSATION_TITLE}
          </p>
          <div className={styles.topActions}>
            <Button type="button" variant="outline" size="sm" onClick={handleNew}>
              <Plus aria-hidden />
              New chat
            </Button>
            <Popover open={conv.historyOpen} onOpenChange={conv.setHistoryOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={conv.historyOpen}>
                  <History aria-hidden />
                  History
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className={styles.historyPanel}>
                <AnecdotalHistoryMenu
                  conversations={conv.conversations}
                  activeId={conv.activeId}
                  onNew={handleNew}
                  onSelect={(id) => conv.switchConversation(id, flow.resetFlow)}
                  onRename={conv.renameConversation}
                  onDelete={(id) => conv.deleteConversation(id, flow.resetFlow)}
                />
              </PopoverContent>
            </Popover>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/teacher/anecdotal/folders")}>
              <Folder aria-hidden />
              Folders
            </Button>
          </div>
        </div>
        <AnecdotalMessageList
          messages={conv.messages}
          messagesRef={messagesRef}
          downloadingId={flow.downloadingId}
          onPreview={(recordId) => flow.setPreviewRecordId(recordId)}
          onDownload={(recordId) => flow.handleFormDownload(recordId)}
          questionSelectedValue={flow.questionSelectedValue}
          onQuestionOptionClick={flow.handleQuestionOptionClick}
          datetimeDateInput={flow.datetimeDateInput}
          setDatetimeDateInput={flow.setDatetimeDateInput}
          datetimeTimeInput={flow.datetimeTimeInput}
          setDatetimeTimeInput={flow.setDatetimeTimeInput}
          datetimePopoverOpen={flow.datetimePopoverOpen}
          setDatetimePopoverOpen={flow.setDatetimePopoverOpen}
          onDatetimeConfirm={flow.handleDatetimeConfirm}
        />
        <AnecdotalChatComposer
          composerRef={composerRef}
          textQuestion={flow.textQuestion}
          textInput={flow.textInput}
          setTextInput={flow.setTextInput}
          reason={flow.reason}
          setReason={flow.setReason}
          canSend={flow.canSend}
          onSend={flow.handleSend}
          students={flow.students}
          sectionNameById={flow.sectionNameById}
          studentId={flow.studentId}
          studentOpen={flow.studentOpen}
          setStudentOpen={flow.setStudentOpen}
          optionsPending={flow.optionsPending}
          onPickStudent={(id) => {
            flow.setStudentId(id);
            const picked = flow.students.find((s) => s.id === id) ?? null;
            if (flow.selectedClass && picked && flow.selectedClass.sectionId !== picked.sectionId) {
              flow.setClassKey("");
            }
          }}
          classes={flow.classes}
          classKey={flow.classKey}
          classOpen={flow.classOpen}
          setClassOpen={flow.setClassOpen}
          hasStudent={flow.student !== null}
          onPickClass={(key) => flow.setClassKey(key)}
          onClear={() => {
            conv.setMessages([]);
            flow.resetFlow();
          }}
        />
        <p className={styles.hint}>{flow.hintText}</p>
      </div>
      <OcForm01PreviewDialog recordId={flow.previewRecordId} onClose={flow.closeFormPreview} />
    </div>
  );
}
