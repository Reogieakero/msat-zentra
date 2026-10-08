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
    setMarks((prev) => ({ ...prev, [id]: status }));
  }, []);
  const merged = React.useMemo(() => ({ ...serverMarks, ...marks }), [serverMarks, marks]);
  return { marks, setMarks, pick, merged };
}
