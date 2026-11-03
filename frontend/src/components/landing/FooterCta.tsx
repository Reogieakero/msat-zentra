import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import shell from "./LandingPage.module.css";
import styles from "./FooterCta.module.css";

export function FooterCta() {
  return (
    <section id="access" className={shell.section}>
      <div className={shell.sectionInner}>
        <Reveal className={styles.panel}>
          <span className={styles.glow} aria-hidden="true" />
          <span className={styles.grid} aria-hidden="true" />
          <div className={styles.inner}>
            <p className={shell.eyebrow}>
              <span className={shell.eyebrowDot} aria-hidden="true" />
              Bring Zentra to your school
            </p>
            <h2 className={styles.heading}>
              Every learner
              <br />
              <span className={styles.accent}>considered.</span>
            </h2>
            <p className={styles.sub}>
              Sign in to your workspace, or request access for a desk at Mati School of
              Arts and Trades. One record, ten roles, no blind spots.
            </p>
            <div className={styles.actions}>
              <Link href="/login" className={styles.primary}>
                Open workspace
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/register" className={styles.secondary}>
                Request access
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
