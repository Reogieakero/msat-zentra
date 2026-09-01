"use client";

import { BookOpen, ArrowRight } from "lucide-react";
import styles from "./AdmPipelineGuide.module.css";

const STEPS = [
  {
    title: "What is ADM?",
    body: "Alternate Delivery Mode (ADM) provides a flexible learning pathway for students who cannot regularly attend traditional classes due to valid circumstances.",
  },
  {
    title: "The Pipeline",
    body: "Each case moves through 8 stages — from initial anecdotal report to final case closure. Track progress and take action at the approval stage.",
  },
  {
    title: "Your Role",
    body: "As principal, you review and sign eligible cases at the School Head Approval stage, authorizing module release and enrollment monitoring.",
  },
];

export function AdmPipelineGuide() {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <BookOpen className={styles.icon} aria-hidden />
        <h2 className={styles.heading}>Understanding the ADM Pipeline</h2>
      </div>
      <div className={styles.grid}>
        {STEPS.map((step, i) => (
          <div key={step.title} className={styles.card}>
            <span className={styles.step}>0{i + 1}</span>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.body}>{step.body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight className={styles.arrow} aria-hidden />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
