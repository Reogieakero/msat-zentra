"use client";

import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import styles from "./form.module.css";

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
    <CardModal
      open
      onClose={onCancel}
      size="sm"
      title={title}
      description={description}
    >
      <div className={styles.dialogFooter}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </CardModal>
  );
}
