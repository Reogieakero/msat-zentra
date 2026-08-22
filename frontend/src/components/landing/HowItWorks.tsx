"use client";

import * as React from "react";
import { ClipboardList, Radar, LifeBuoy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    id: "capture",
    icon: ClipboardList,
    title: "Capture",
    bullets: [
      "Teachers log grades and AM/PM attendance; advisers file anecdotal records.",
      "Every entry lands in one system of record the moment it is made — timestamped, attributed, and never waiting on a batch export.",
      "That live capture is what makes early detection possible: a risk flag is only early if the signal arrives early.",
      "Grade components, session headcounts, and confidential notes all converge into the same ledger as they happen, so nothing hides in a spreadsheet until it is too late.",
    ],
    visual: {
      label: "Teacher console",
      address: "zentra.msat.edu.ph/teacher",
      rows: [
        { k: "Period 1 · Math", v: "87 / 100" },
        { k: "Period 3 · Science", v: "72 / 100" },
        { k: "AM attendance", v: "32 / 33" },
        { k: "PM attendance", v: "31 / 33" },
        { k: "Anecdotal", v: "1 filed" },
        { k: "Last sync", v: "just now" },
      ],
    },
  },
  {
    id: "detect",
    icon: Radar,
    title: "Detect",
    bullets: [
      "The risk engine flags Low / Moderate / High across academic, attendance, and behavioral signals in real time — before a term slips away.",
      "Academic, attendance, and behavioral signals are scored the moment new data lands.",
      "Latency stays under one second, so a flag is raised while there is still time to act.",
    ],
    visual: {
      label: "Risk engine",
      address: "zentra.msat.edu.ph/risk",
      rows: [
        { k: "Academic", v: "High", tone: "high" },
        { k: "Attendance", v: "Moderate", tone: "mod" },
        { k: "Behavior", v: "Low", tone: "low" },
        { k: "Latency", v: "< 1s" },
      ],
    },
  },
  {
    id: "intervene",
    icon: LifeBuoy,
    title: "Intervene",
    bullets: [
      "Referrals route to guidance, nurse, or ADM; interventions are reviewed, approved, and tracked to outcome across the term.",
      "Each referral is owned by the right role — guidance, nurse, or ADM — from the first alert.",
      "Every intervention is reviewed, approved, and followed to a recorded outcome, never left open.",
    ],
    visual: {
      label: "Referral routing",
      address: "zentra.msat.edu.ph/referrals",
      rows: [
        { k: "→ Guidance", v: "2 open" },
        { k: "→ Nurse", v: "1 open" },
        { k: "→ ADM", v: "1 open" },
        { k: "Closed", v: "4" },
      ],
    },
  },
];

export function HowItWorks() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const ticking = React.useRef(false);
  const programmatic = React.useRef(false);
  const lastIdx = React.useRef(0);

  // Scroll position drives the active tab while the section is in view.
  // State only updates when the step index actually changes, so passive
  // scrolling doesn't trigger a re-render on every frame.
  React.useEffect(() => {
    const computeIdx = () => {
      const section = sectionRef.current;
      if (!section || programmatic.current) return lastIdx.current;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = total > 0 ? scrolled / total : 0;
      return Math.min(steps.length - 1, Math.floor(progress * steps.length));
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const idx = computeIdx();
        if (idx !== lastIdx.current) {
          lastIdx.current = idx;
          setActiveIdx(idx);
        }
        ticking.current = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const current = steps[activeIdx];
  const Icon = current.icon;

  // Clicking a tab smooth-scrolls the section to that step.
  const selectTab = (i: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = rect.height - vh;
    const targetTop = rect.top + (i / steps.length) * total;
    programmatic.current = true;
    setActiveIdx(i);
    window.scrollTo({ top: window.scrollY + targetTop, behavior: "smooth" });
    window.setTimeout(() => {
      programmatic.current = false;
    }, 600);
  };

  return (
    <section
      id="how"
      ref={sectionRef}
      className={styles.section}
      style={{ minHeight: `${steps.length * 100}vh` }}
    >
      <div className={styles.sticky}>
        <div className={styles.inner}>
          <div className={styles.head}>
            <h2 className={styles.heading}>
              From classroom signal to early action
            </h2>
            <p className={styles.subhead}>
              Three steps turn daily records into intervention — captured where
              learning happens, detected before it drifts, acted on by the right
              role. Scroll to move through each step.
            </p>
          </div>

          <Tabs
            value={current.id}
            onValueChange={(v) => selectTab(steps.findIndex((s) => s.id === v))}
            className={styles.tabsRoot}
          >
            <TabsList className={styles.tabsList}>
              {steps.map((s, i) => {
                const TabIcon = s.icon;
                return (
                  <TabsTrigger key={s.id} value={s.id} className={styles.tabTrigger}>
                    <span className={styles.tabNum}>{i + 1}</span>
                    <TabIcon size={16} />
                    {s.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {steps.map((s) => (
              <TabsContent key={s.id} value={s.id} className={styles.tabContent}>
                <div className={styles.layout}>
                  <div className={styles.stepDetail}>
                    <h3 className={styles.stepTitle}>
                      <span className={styles.stepIconInline}>
                        <s.icon size={18} />
                      </span>
                      {s.title}
                    </h3>
                    <ul className={styles.captureBullets}>
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <aside className={styles.panel} aria-hidden="true">
                    <div className={styles.panelCard}>
                      <div className={styles.panelChrome}>
                        <span className={styles.dot} data-tone="red" />
                        <span className={styles.dot} data-tone="amber" />
                        <span className={styles.dot} data-tone="green" />
                        {s.visual.address && (
                          <span className={styles.panelAddress}>
                            {s.visual.address}
                          </span>
                        )}
                      </div>
                      <div key={s.id} className={styles.panelContent}>
                        <span className={styles.panelLabel}>
                          {s.visual.label}
                        </span>
                        <dl className={styles.panelRows}>
                          {s.visual.rows.map((r) => (
                            <div key={r.k} className={styles.panelRow}>
                              <dt className={styles.panelKey}>{r.k}</dt>
                              <dd
                                className={`${styles.panelVal} ${
                                  "tone" in r && r.tone ? styles[`tone_${r.tone}`] : ""
                                }`}
                              >
                                {r.v}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
