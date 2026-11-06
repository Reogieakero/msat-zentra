import { Reveal } from "./Reveal";
import shell from "./LandingPage.module.css";
import styles from "./Roles.module.css";

const roles = [
  {
    name: "Principal",
    line: "School-wide oversight, term management, final ADM approval, audit.",
  },
  {
    name: "Registrar",
    line: "Senior high records, SF10, final grades, student account approval.",
  },
  {
    name: "Record Keeper",
    line: "Junior high records, SF10, final grades, adviser access requests.",
  },
  {
    name: "ADM Coordinator",
    line: "ADM cases, parent meetings, devices, certification, forwarding.",
  },
  {
    name: "Guidance Counselor",
    line: "Referrals, counseling sessions, at-risk alerts, interventions.",
  },
  {
    name: "School Nurse",
    line: "Clinic referrals, health records, and ADM and clinic queues.",
  },
  {
    name: "Adviser",
    line: "Section roster, attendance, grade approval, ADM monitoring, modules.",
  },
  {
    name: "Subject Teacher",
    line: "Grading, per-subject attendance, anecdotal records, schedule.",
  },
  {
    name: "Student",
    line: "Assigned modules, link or file submissions, due dates, and status.",
  },
  {
    name: "Parent / Guardian",
    line: "Account support today; a dedicated family portal is in progress.",
  },
];

export function Roles() {
  return (
    <section id="roles" className={shell.section}>
      <div className={shell.sectionInner}>
        <Reveal as="header" className={styles.head}>
          <p className={shell.eyebrow}>
            <span className={shell.eyebrowDot} aria-hidden="true" />
            Ten workspaces
          </p>
          <h2 className={shell.heading}>
            One school, <span className={shell.headingAccent}>every role</span>
          </h2>
          <p className={shell.lead}>
            Each role sees exactly what it needs — and nothing it should not. Access is
            enforced on the server, not hidden in the interface.
          </p>
        </Reveal>

        <ul className={styles.list}>
          {roles.map((role, index) => (
            <Reveal
              as="li"
              key={role.name}
              className={styles.item}
              style={{ ["--reveal-delay" as string]: `${60 + index * 35}ms` }}
            >
              <div className={styles.rowTop}>
                <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.arrow} aria-hidden="true">
                  ↗
                </span>
              </div>
              <h3 className={styles.name}>{role.name}</h3>
              <p className={styles.line}>{role.line}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
