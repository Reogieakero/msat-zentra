import { Reveal } from "./Reveal";
import shell from "./LandingPage.module.css";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    title: "Capture",
    body: "Teachers log grades and attendance; advisers file anecdotal records. Every entry lands timestamped and attributed the moment it is made — no batch export, no waiting for the term to end.",
    meta: "Classroom signal",
    rows: [
      { key: "Period 1 · Math", value: "87 / 100" },
      { key: "Period 3 · Science", value: "72 / 100" },
      { key: "AM attendance", value: "32 / 33" },
      { key: "Anecdotal", value: "1 filed" },
    ],
  },
  {
    title: "Detect",
    body: "The risk engine scores academic, attendance, and behavioral signals across each term and raises Low / Moderate / High flags before drift becomes failure.",
    meta: "Early warning",
    rows: [
      { key: "Academic", value: "High", tone: "high" },
      { key: "Attendance", value: "Moderate", tone: "moderate" },
      { key: "Behavior", value: "Low", tone: "low" },
      { key: "Signal latency", value: "< 1 s" },
    ],
  },
  {
    title: "Act",
    body: "Referrals route to guidance, the nurse, or ADM. Interventions are approved and followed to a recorded outcome — nothing stays open without an owner.",
    meta: "Right role, right case",
    rows: [
      { key: "→ Guidance", value: "2 open" },
      { key: "→ Nurse", value: "1 open" },
      { key: "→ ADM", value: "1 open" },
      { key: "Closed", value: "4" },
    ],
  },
];

export function HowItWorks() {
  return (
    <section id="how" className={shell.section}>
      <div className={shell.sectionInner}>
        <Reveal as="header" className={styles.head}>
          <p className={shell.eyebrow}>
            <span className={shell.eyebrowDot} aria-hidden="true" />
            The process
          </p>
          <h2 className={shell.heading}>
            From classroom signal to{" "}
            <span className={shell.headingAccent}>early action</span>
          </h2>
          <p className={shell.lead}>
            Three steps turn daily records into intervention — captured where learning
            happens, detected before it drifts, acted on by the right role.
          </p>
        </Reveal>

        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              className={styles.step}
              style={{ ["--reveal-delay" as string]: `${100 + index * 90}ms` }}
            >
              <div className={styles.text}>
                <div className={styles.stepTop}>
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.meta}>{step.meta}</span>
                </div>
                <h3 className={styles.title}>{step.title}</h3>
                <p className={styles.body}>{step.body}</p>
              </div>

              <div className={styles.panel} aria-hidden="true">
                <div className={styles.panelHead}>
                  <span className={styles.panelDot} />
                  <span className={styles.panelLabel}>zentra / {step.title.toLowerCase()}</span>
                </div>
                <dl className={styles.rows}>
                  {step.rows.map((row) => (
                    <div key={row.key} className={styles.row}>
                      <dt className={styles.key}>{row.key}</dt>
                      <dd
                        className={`${styles.value} ${
                          "tone" in row && row.tone ? styles[row.tone] : ""
                        }`}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
