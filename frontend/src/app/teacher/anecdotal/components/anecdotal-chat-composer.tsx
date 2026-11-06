"use client";
import { ArrowUp, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AnecdotalClassOption,
  AnecdotalStudent,
} from "@/services/anecdotal/anecdotal.types";
import { ClassPicker, StudentPicker } from "./AnecdotalPickers";
import {
  TEXT_QUESTION_LABELS,
  TEXT_QUESTION_PLACEHOLDERS,
  type TextQuestionKey,
} from "./use-anecdotal-chat-flow";
import styles from "./AnecdotalChat.module.css";
interface Props {
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  textQuestion: TextQuestionKey;
  textInput: string;
  setTextInput: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  canSend: boolean;
  onSend: () => void;
  students: AnecdotalStudent[];
  sectionNameById: Map<string, string>;
  studentId: string;
  studentOpen: boolean;
  setStudentOpen: (v: boolean) => void;
  optionsPending: boolean;
  onPickStudent: (id: string) => void;
  classes: AnecdotalClassOption[];
  classKey: string;
  classOpen: boolean;
  setClassOpen: (v: boolean) => void;
  hasStudent: boolean;
  onPickClass: (key: string) => void;
  onClear: () => void;
}
export function AnecdotalChatComposer({
  composerRef,
  textQuestion,
  textInput,
  setTextInput,
  reason,
  setReason,
  canSend,
  onSend,
  students,
  sectionNameById,
  studentId,
  studentOpen,
  setStudentOpen,
  optionsPending,
  onPickStudent,
  classes,
  classKey,
  classOpen,
  setClassOpen,
  hasStudent,
  onPickClass,
  onClear,
}: Props) {
  return (
    <div className={styles.composer}>
      <div className={styles.inputRow}>
        <Textarea
          ref={composerRef}
          value={textQuestion !== null ? textInput : reason}
          onChange={(e) => {
            if (textQuestion !== null) setTextInput(e.target.value);
            else setReason(e.target.value);
          }}
          placeholder={
            textQuestion
              ? TEXT_QUESTION_PLACEHOLDERS[textQuestion]
              : "Pick a student to start"
          }
          aria-label={
            textQuestion ? TEXT_QUESTION_LABELS[textQuestion] : "Incident description"
          }
          rows={3}
          maxLength={2000}
          className={styles.input}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={textQuestion === null}
        />
        <Button
          type="button"
          size="icon"
          className={styles.sendBtn}
          disabled={!canSend}
          onClick={onSend}
          aria-label={textQuestion ? "Send answer" : "File GCForm-01"}
        >
          <ArrowUp aria-hidden />
        </Button>
      </div>
      <div className={styles.composerBar}>
        <StudentPicker
          open={studentOpen}
          onOpenChange={setStudentOpen}
          students={students}
          sectionNameById={sectionNameById}
          selectedId={studentId}
          isPending={optionsPending}
          onPick={onPickStudent}
        />
        <ClassPicker
          open={classOpen}
          onOpenChange={setClassOpen}
          classes={classes}
          selectedKey={classKey}
          hasStudent={hasStudent}
          isPending={optionsPending}
          onPick={onPickClass}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={styles.historyBtn}
          onClick={onClear}
          aria-label="Clear current chat"
          title="Clear current chat"
        >
          <Eraser aria-hidden />
        </Button>
      </div>
    </div>
  );
}
