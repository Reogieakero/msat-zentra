"use client";

import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 24px overlay actions — same metric as every desk confirmation. */
const OVERLAY_BTN = "h-6 px-3 text-xs";

export function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <KanbanOverlay
      open
      onClose={onCancel}
      width="sm"
      title={title}
      description={description}
      footer={
        <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
          <Button
            size="sm"
            className={
              destructive
                ? `${OVERLAY_BTN} bg-red-600 text-white hover:bg-red-700`
                : OVERLAY_BTN
            }
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      }
    />
  );
}
