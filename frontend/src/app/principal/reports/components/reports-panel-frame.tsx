import * as React from "react";
import { FileBarChart, Info } from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import styles from "./reports-panels.module.css";
export function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.interpretation}>
      <span className={styles.interpretationLabel}>What it means · </span>
      {children}
    </p>
  );
}
export function PanelFrame({
  title,
  hint,
  children,
  banner,
  action,
  message,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  banner?: string;
  action?: React.ReactNode;
  message?: React.ReactNode;
}) {
  return (
    <Card className={styles.panel}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader className={styles.panelHead}>
        <div>
          <CardTitle className={styles.panelTitle}>{title}</CardTitle>
          <span className={styles.panelHint}>{hint}</span>
        </div>
        {action ? <div className={styles.panelAction}>{action}</div> : null}
      </CardHeader>
      <CardContent className={styles.panelContent}>
        {banner ? (
          <div className={styles.banner}>
            <Info size={14} />
            {banner}
          </div>
        ) : null}
        {children}
        {message ? <PanelMessage>{message}</PanelMessage> : null}
      </CardContent>
    </Card>
  );
}
export function EmptyState() {
  return (
    <PrincipalEmptyState
      icon={FileBarChart}
      title="No data for this scope"
      hint="No data for the selected scope. Records will appear here once available."
    />
  );
}
