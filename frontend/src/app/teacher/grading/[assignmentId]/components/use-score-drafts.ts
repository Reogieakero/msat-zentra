"use client";
import * as React from "react";
import { clearStoredDrafts, readStoredDrafts, typedCache, writeStoredDrafts } from "./score-storage";
export function useScoreDrafts(teacherId: string, assessmentId: string) {
  const [scores, setScores] = React.useState<Record<string, string>>({});
  const [recovered, setRecovered] = React.useState(false);
  const [restoredMax, setRestoredMax] = React.useState<string | null>(null);
  const maxRef = React.useRef<HTMLInputElement>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setRecovered(false);
    setRestoredMax(null);
    typedCache.clear();
    if (assessmentId) {
      const stored = readStoredDrafts(teacherId, assessmentId);
      if (Object.keys(stored.scores).length > 0) {
        setScores(stored.scores);
        for (const [k, v] of Object.entries(stored.scores)) {
          typedCache.set(`${assessmentId}:${k}`, v);
        }
        setRecovered(true);
      } else {
        setScores({});
      }
      if (stored.max !== null) setRestoredMax(stored.max);
    } else {
      setScores({});
    }
  }, [teacherId, assessmentId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const onDraft = React.useCallback((studentId: string, value: string) => {
    let next: Record<string, string> | null = null;
    setScores((prev) => {
      next = { ...prev, [studentId]: value };
      return next;
    });
    const max = maxRef.current?.value ?? null;
    queueMicrotask(() => {
      if (next) writeStoredDrafts(teacherId, assessmentId, next, max === "" ? null : max);
    });
  }, [teacherId, assessmentId]);
  const clear = React.useCallback(() => {
    setRecovered(false);
    setRestoredMax(null);
    typedCache.clear();
    if (assessmentId) {
      clearStoredDrafts(teacherId, assessmentId);
      setScores({});
    }
  }, [teacherId, assessmentId]);
  const writeMax = React.useCallback((max: string | null) => {
    if (!assessmentId) return;
    setScores((prev) => {
      writeStoredDrafts(teacherId, assessmentId, prev, max);
      return prev;
    });
  }, [teacherId, assessmentId]);
  return { scores, setScores, recovered, setRecovered, restoredMax, setRestoredMax, onDraft, clear, writeMax, maxRef };
}
