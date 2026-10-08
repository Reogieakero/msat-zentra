"use client";
import * as React from "react";
export function useAdmNotice(resubmitHintSignal?: number) {
  const [noticeVisible, setNoticeVisible] = React.useState(false);
  const [portalTarget] = React.useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null
  );
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSignal = React.useRef(resubmitHintSignal ?? 0);
  const showReminder = React.useCallback(() => {
    setNoticeVisible(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNoticeVisible(false);
      noticeTimer.current = null;
    }, 4000);
  }, []);
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    const signal = resubmitHintSignal ?? 0;
    if (signal === lastSignal.current) return;
    lastSignal.current = signal;
    if (signal > 0) showReminder();
  }, [resubmitHintSignal, showReminder]);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  const handleNoticeClose = React.useCallback(() => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNoticeVisible(false);
  }, []);
  return { noticeVisible, portalTarget, showReminder, handleNoticeClose };
}
