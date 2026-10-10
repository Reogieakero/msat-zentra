"use client";
import * as React from "react";
import type { SheetStatus } from "@/services/teacher/attendance.types";
import { loadStoredMarks, persistStoredMarks } from "./attendance-storage";
export function useRosterMarks(sheetKey: string, serverMarks: Record<string, SheetStatus>) {
  const [seenKey, setSeenKey] = React.useState(sheetKey);
  const [marks, setMarks] = React.useState<Record<string, SheetStatus>>(() =>
    loadStoredMarks(sheetKey),
  );
  if (seenKey !== sheetKey) {
    setSeenKey(sheetKey);
    setMarks(loadStoredMarks(sheetKey));
  }
  React.useEffect(() => {
    persistStoredMarks(sheetKey, marks);
  }, [sheetKey, marks]);
  const pick = React.useCallback((id: string, status: SheetStatus) => {
    // Toggle: tapping the currently shown status clears the local pick and
    // falls back to the saved server mark (or unmarked when never saved).
    setMarks((prev) => {
      const current = prev[id] ?? serverMarks[id] ?? null;
      if (current === status) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: status };
    });
  }, [serverMarks]);
  const merged = React.useMemo(() => ({ ...serverMarks, ...marks }), [serverMarks, marks]);
  return { marks, setMarks, pick, merged };
}
