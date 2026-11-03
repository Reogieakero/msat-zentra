import { Reveal } from "./Reveal";
import shell from "./LandingPage.module.css";
import styles from "./Stats.module.css";

const stats = [
  { value: "7–12", label: "Grades served" },
  { value: "3", label: "Terms per school year" },
  { value: "10", label: "Role-based workspaces" },
  { value: "1", label: "Shared system of record" },
];

export function Stats() {
  return (
    <section className={shell.section}>
      <div className={shell.sectionInner}>
        <Reveal as="ul" className={styles.list}>
          {stats.map((stat, index) => (
            <li
              key={stat.label}
              className={styles.item}
              style={{ ["--reveal-delay" as string]: `${index * 70}ms` }}
            >
              <span className={styles.value}>{stat.value}</span>
              <span className={styles.label}>{stat.label}</span>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
