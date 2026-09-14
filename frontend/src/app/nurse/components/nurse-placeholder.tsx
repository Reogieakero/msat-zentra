import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import styles from "./nurse-placeholder.module.css";

type NursePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  comingSoon: string[];
};

export function NursePlaceholder({ eyebrow, title, description, comingSoon }: NursePlaceholderProps) {
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{description}</p>

      <Card className={styles.card}>
        <CardTitle className={styles.cardTitle}>Coming soon</CardTitle>
        <CardDescription className={styles.cardDesc}>
          This page is a placeholder. The clinical workflow for this section has not been built yet.
        </CardDescription>
        <ul className={styles.list}>
          {comingSoon.map((item) => (
            <li key={item} className={styles.listItem}>
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
