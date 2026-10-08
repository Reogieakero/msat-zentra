"use client";
import { useState } from "react";
import type {
  AtRiskStudentItem,
  InterventionOutcome,
} from "@/services/guidance/interventions.types";
import type { InterventionDialogKey } from "./intervention-dialogs";
export function useInterventionDialogState(students: AtRiskStudentItem[]) {
  const [dialogs, setDialogs] = useState<Record<InterventionDialogKey, boolean>>({
    start: false,
    change: false,
    outcome: false,
    schedule: false,
    finish: false,
    move: false,
    cancelSess: false,
  });
  const [collapsedPlans, setCollapsedPlans] = useState<Record<string, boolean>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeFollowUpId, setActiveFollowUpId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");
  const [priority, setPriority] = useState("normal");
  const [intakeNotes, setIntakeNotes] = useState("");
  const [sessDate, setSessDate] = useState("");
  const [sessTime, setSessTime] = useState("");
  const [sessType, setSessType] = useState("individual");
  const [sessVenue, setSessVenue] = useState("");
  const [outcomeStatus, setOutcomeStatus] =
    useState<InterventionOutcome>("ongoing");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const activeRow = students.find((r) => r.studentKey === activeKey) ?? null;
  const activeFollowUp = activeRow?.intervention ?? null;
  const activeSession =
    activeFollowUp?.sessions.find((s) => s.id === activeSessionId) ?? null;
  const resetSessionForm = () => {
    setSessDate("");
    setSessTime("");
    setSessType("individual");
    setSessVenue("");
  };
  const closeDialog = (dialog: InterventionDialogKey) => {
    setDialogs((p) => ({ ...p, [dialog]: false }));
  };
  const openStart = (row: AtRiskStudentItem) => {
    setActiveKey(row.studentKey);
    setActiveFollowUpId(null);
    setActionText("");
    setPriority("normal");
    setIntakeNotes("");
    resetSessionForm();
    setDialogs((p) => ({ ...p, start: true }));
  };
  const openChange = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setActionText(row.intervention.recommendedAction);
    setDialogs((p) => ({ ...p, change: true }));
  };
  const openOutcome = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setOutcomeStatus(row.intervention.outcomeStatus);
    setOutcomeNotes(row.intervention.outcomeNotes);
    setDialogs((p) => ({ ...p, outcome: true }));
  };
  const openSchedule = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    resetSessionForm();
    setDialogs((p) => ({ ...p, schedule: true }));
  };
  const openSessionDialog = (
    row: AtRiskStudentItem,
    session: { id: string },
    dialog: "finish" | "move" | "cancelSess"
  ) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setActiveSessionId(session.id);
    setDialogs((p) => ({ ...p, [dialog]: true }));
  };
  const clearActive = () => {
    setActiveKey(null);
    setActiveFollowUpId(null);
    setActiveSessionId(null);
  };
  const closeAllDialogs = () => {
    setDialogs({
      start: false,
      change: false,
      outcome: false,
      schedule: false,
      finish: false,
      move: false,
      cancelSess: false,
    });
  };
  return {
    dialogs,
    setDialogs,
    collapsedPlans,
    setCollapsedPlans,
    expandedKey,
    setExpandedKey,
    activeKey,
    activeFollowUpId,
    activeSessionId,
    actionText,
    setActionText,
    priority,
    setPriority,
    intakeNotes,
    setIntakeNotes,
    sessDate,
    setSessDate,
    sessTime,
    setSessTime,
    sessType,
    setSessType,
    sessVenue,
    setSessVenue,
    outcomeStatus,
    setOutcomeStatus,
    outcomeNotes,
    setOutcomeNotes,
    activeRow,
    activeFollowUp,
    activeSession,
    resetSessionForm,
    closeDialog,
    openStart,
    openChange,
    openOutcome,
    openSchedule,
    openSessionDialog,
    clearActive,
    closeAllDialogs,
  };
}
