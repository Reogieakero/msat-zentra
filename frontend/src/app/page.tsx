import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.mark}>Z</span>
        <span className={styles.wordmark}>Zentra</span>
        <span className={styles.tag}>Student Information System</span>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Mati School of Arts and Trades</p>
        <h1 className={styles.title}>
          One record, every learner signal.
        </h1>
        <p className={styles.lede}>
          Grading, attendance, anecdotal records, and early-intervention risk —
          unified for teachers, guidance, and school leadership.
        </p>

        <div className={styles.actions}>
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#overview">Learn more</Link>
          </Button>
        </div>
      </section>

      <section id="overview" className={styles.modules}>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Grading &amp; Transmutation</h2>
          <p className={styles.cardText}>
            DepEd-weighted components, computed finals, and registrar validation.
          </p>
        </article>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Attendance</h2>
          <p className={styles.cardText}>
            AM/PM sessions with term-rate computation and risk flags.
          </p>
        </article>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Early Intervention</h2>
          <p className={styles.cardText}>
            Rule-based risk detection across academic, attendance, and behavior.
          </p>
        </article>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Confidential by Design</h2>
          <p className={styles.cardText}>
            Tiered anecdotal, health, and ADM records with strict RBAC.
          </p>
        </article>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Zentra · MSAT</span>
      </footer>
    </main>
  );
}
