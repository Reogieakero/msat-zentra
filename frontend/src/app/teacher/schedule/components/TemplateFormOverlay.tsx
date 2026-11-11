"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * Backdrop + centered sheet for the catalog add forms. The form itself is an
 * existing KanbanBoard card (title, actions, footer), so this only supplies the
 * scrim, Escape/backdrop close and the scroll box — the record list stays put
 * underneath.
 */
export function TemplateFormOverlay({ open, onClose, label, children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Guards the document.body portal during prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px] dark:bg-black/70"
      />
      <div className="relative max-h-[85dvh] w-full max-w-xl overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
    </div>,
    document.body,
  );
}
