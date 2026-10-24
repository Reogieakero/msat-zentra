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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    />
  );
}
