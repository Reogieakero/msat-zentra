import { FileText, Award } from "lucide-react";
import styles from "./attention-panel.module.css";
import type { RegistrarOverviewData } from "./data";

export function AttentionPanel({ data }: { data: RegistrarOverviewData }) {
  const items = [
    {
      icon: FileText,
      label: "SF10 records missing",
      value: data.missingSf10.length,
      scope: "across G11–12",
      tone: "warn",
    },
    {
      icon: Award,
      label: "Locked finals awaiting approval",
      value: data.lockedFinalsAwaiting,
      scope: "",
      tone: "info",
    },
  ] as const;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>Attention</h2>
      </header>

      <ul className={styles.list}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label} className={`${styles.row} ${styles[it.tone]}`}>
              <span className={styles.iconWrap}>
                <Icon className={styles.iconSvg} />
              </span>
              <div className={styles.meta}>
                <span className={styles.label}>{it.label}</span>
                {it.scope ? <span className={styles.scope}>{it.scope}</span> : null}
              </div>
              <span className={styles.value}>{it.value}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
