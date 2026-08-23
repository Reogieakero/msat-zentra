import { Reveal } from "./Reveal";
import styles from "./Stats.module.css";

const stats = [
  { value: "7–12", label: "Grades served" },
  { value: "3", label: "Terms / year" },
  { value: "10", label: "Role-based workspaces" },
  { value: "Real-time", label: "Risk flagging" },
];

export function Stats() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <Reveal as="ul" className={styles.list}>
          {stats.map((s, i) => (
            <li
              key={s.label}
              className={styles.item}
              style={{ ["--reveal-delay" as string]: `${i * 80}ms` }}
            >
              <span className={styles.value}>{s.value}</span>
              <span className={styles.label}>{s.label}</span>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
