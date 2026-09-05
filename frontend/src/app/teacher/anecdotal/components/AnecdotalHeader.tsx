"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import styles from "./AnecdotalHeader.module.css";

interface AnecdotalHeaderProps {
  onNew: () => void;
}

export function AnecdotalHeader({ onNew }: AnecdotalHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.titleWrap}>
        <h1 className={styles.title}>Anecdotal Records</h1>
        <p className={styles.subtitle}>
          Behavior and incident reports you filed for your advisees.
        </p>
      </div>
      <Button type="button" onClick={onNew}>
        <Plus aria-hidden />
        New record
      </Button>
    </div>
  );
}
