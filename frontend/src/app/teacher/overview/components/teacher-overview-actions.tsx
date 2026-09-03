"use client";

import * as React from "react";
import styles from "./teacher-overview-actions.module.css";

interface ActionCardProps {
  title: string;
  description: string;
}

export function ActionCard({ title, description }: ActionCardProps) {
  return (
    <button type="button" className={styles.actionCard}>
      <span className={styles.actionTitle}>{title}</span>
      <span className={styles.actionDesc}>{description}</span>
    </button>
  );
}

interface TeacherOverviewActionsProps {
  actions: { title: string; description: string }[];
}

export function TeacherOverviewActions({ actions }: TeacherOverviewActionsProps) {
  return (
    <div className={styles.actionCol}>
      {actions.map((action) => (
        <ActionCard key={action.title} title={action.title} description={action.description} />
      ))}
    </div>
  );
}