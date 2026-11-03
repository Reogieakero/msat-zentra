import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Palette } from "./palette";
import { LivingOrb } from "./LivingOrb";
import styles from "./Hero.module.css";

export function Hero({ palette }: { palette: Palette }) {
  return (
    <section id="overview" className={styles.hero}>
      <div className={styles.aurora} aria-hidden="true">
        <span className={styles.blobMint} />
        <span className={styles.blobViolet} />
        <span className={styles.blobDeep} />
      </div>
      <div className={styles.grain} aria-hidden="true" />
      <LivingOrb palette={palette} />

      <div className={styles.frame}>
        <div className={styles.headlineWrap}>
          <p className={styles.kicker}>
            <span className={styles.kickerDot} aria-hidden="true" />
            Zentra · Mati School of Arts and Trades
          </p>
          <h1 className={styles.title}>
            <span className={styles.lineMask}>
              <span className={styles.line} style={{ ["--line-delay" as string]: "120ms" }}>
                Every learner,
              </span>
            </span>
            <span className={styles.lineMask}>
              <span
                className={`${styles.line} ${styles.titleAccent}`}
                style={{ ["--line-delay" as string]: "260ms" }}
              >
                in focus.
              </span>
            </span>
          </h1>
          <p className={styles.sub}>
            A living record of grades, attendance, well-being, and intervention — read
            in motion, answered early.
          </p>
        </div>

        <div className={styles.bottom}>
          <div className={styles.signal}>
            <p className={styles.signalText}>
              It reads every signal — grades, attendance, anecdotes — and answers
              before a term slips away.
            </p>
            <p className={styles.tags}>
              <span>[ Learner records ]</span>
              <span aria-hidden="true">·</span>
              <span>[ Early intervention ]</span>
              <span aria-hidden="true">·</span>
              <span>[ ADM ]</span>
            </p>
          </div>

          <div className={styles.aside}>
            <p className={styles.asideText}>
              One system of record for teachers, guidance, health, ADM, and school
              leadership. Ten workspaces, one shared truth.
            </p>
            <div className={styles.actions}>
              <Link href="/login" className={styles.primary}>
                Open workspace
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link href="#modules" className={styles.iconButton} aria-label="Explore modules">
                <Sparkles size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.scrollCue} aria-hidden="true">
          <span className={styles.scrollLine} />
          <span>Scroll to explore</span>
        </div>
      </div>
    </section>
  );
}
