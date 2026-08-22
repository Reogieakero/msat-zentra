"use client";

import * as React from "react";
import {
  Boxes,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";
import styles from "./DesignApproach.module.css";

const blocks = [
  {
    id: "plugin",
    icon: Boxes,
    title: "Everything is a plugin",
    lead: "One composable core, every capability swappable.",
    body: [
      "Zentra is built on a plugin kernel where every school capability — grading, attendance, behavior flags, health and ADM records, scheduling, reporting, and the web UI — lives in its own module.",
      "Modules talk to each other through shared services and events, so a registrar can swap the transmutation rule set, a guidance lead can extend the risk engine, or an ADM coordinator can add a record tier without forking the system.",
      "You select, swap, or extend any capability in configuration. The core stays untouched, and the deployment stays yours.",
    ],
    visual: {
      kind: "list" as const,
      caption: "Installed modules",
      items: [
        { k: "Grading", v: "active" },
        { k: "Attendance", v: "active" },
        { k: "Risk engine", v: "active" },
        { k: "ADM records", v: "configurable" },
        { k: "Reporting", v: "configurable" },
      ],
    },
  },
  {
    id: "traceable",
    icon: ScrollText,
    title: "Every run is traceable",
    lead: "An append-only record of everything that happened.",
    body: [
      "Every action the system takes is written to an append-only audit log: who opened a record, which rule fired, what the engine computed, which referral was routed, and every approval or override.",
      "In the Trajectory view, staff with the right role can inspect each event by source — a teacher's entry, an automated flag, a guidance note — and trace any outcome back to the exact signal that triggered it.",
      "Resume, fork, search, and review all operate on the same event stream, so a term's story is never lost and never rewritten.",
    ],
    visual: {
      kind: "log" as const,
      caption: "Session log",
      rows: [
        { t: "08:14", e: "attendance.sync", s: "ok" },
        { t: "08:31", e: "risk.flag · High", s: "warn" },
        { t: "09:02", e: "referral.route → guidance", s: "ok" },
        { t: "09:20", e: "approval · adviser", s: "ok" },
      ],
    },
  },
  {
    id: "modes",
    icon: SlidersHorizontal,
    title: "Multiple runtime modes",
    lead: "Right surface for every role and task.",
    body: [
      "Standard mode is the full workspace: grades, attendance, risk flags, referrals, and dashboards for every role from teacher to principal.",
      "Capture mode strips the surface to logging only — teachers and advisers enter signal fast, with the engine running quietly in the background.",
      "Review mode opens the Trajectory and confidentiality views for guidance, nurse, and ADM — read and act on sensitive records with full audit context.",
      "Admin mode exposes module configuration, RBAC tiers, and the audit console, so the people who own the system can reshape it without code.",
    ],
    visual: {
      kind: "modes" as const,
      caption: "Active mode",
      items: [
        { k: "Standard", v: "full workspace" },
        { k: "Capture", v: "signal entry" },
        { k: "Review", v: "trajectory + RBAC" },
        { k: "Admin", v: "config + audit" },
      ],
    },
  },
];

export function DesignApproach() {
  return (
    <section id="design" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <h2 className={styles.heading}>Design approach</h2>
          <p className={styles.subhead}>
            Everything is a plugin. Every run is traceable. The same principles
            that keep an agent harness honest keep a school system accountable.
          </p>
        </header>

        <div className={styles.blocks}>
          {blocks.map(({ id, icon: Icon, title, lead, body, visual }) => (
            <article key={id} className={styles.block}>
              <div className={styles.text}>
                <span className={styles.icon}>
                  <Icon size={20} />
                </span>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.lead}>{lead}</p>
                {body.map((p, i) => (
                  <p key={i} className={styles.para}>
                    {p}
                  </p>
                ))}
              </div>

              <div className={styles.visual} aria-hidden="true">
                {visual.kind === "list" && (
                  <div className={styles.panel}>
                    <span className={styles.panelCaption}>
                      {visual.caption}
                    </span>
                    <ul className={styles.moduleList}>
                      {visual.items.map((it) => (
                        <li key={it.k} className={styles.moduleItem}>
                          <span className={styles.moduleName}>{it.k}</span>
                          <span
                            className={`${styles.moduleStatus} ${
                              it.v === "active"
                                ? styles.statusActive
                                : styles.statusConfig
                            }`}
                          >
                            {it.v}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visual.kind === "log" && (
                  <div className={styles.panel}>
                    <span className={styles.panelCaption}>
                      {visual.caption}
                    </span>
                    <ul className={styles.logList}>
                      {visual.rows.map((r, i) => (
                        <li key={i} className={styles.logRow}>
                          <span className={styles.logTime}>{r.t}</span>
                          <span className={styles.logEvent}>{r.e}</span>
                          <span
                            className={`${styles.logDot} ${
                              r.s === "warn" ? styles.dotWarn : styles.dotOk
                            }`}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visual.kind === "modes" && (
                  <div className={styles.panel}>
                    <span className={styles.panelCaption}>
                      {visual.caption}
                    </span>
                    <dl className={styles.modeList}>
                      {visual.items.map((it) => (
                        <div key={it.k} className={styles.modeRow}>
                          <dt className={styles.modeName}>{it.k}</dt>
                          <dd className={styles.modeDesc}>{it.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
