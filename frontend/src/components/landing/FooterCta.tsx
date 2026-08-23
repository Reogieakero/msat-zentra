import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./Reveal";
import styles from "./FooterCta.module.css";

export function FooterCta() {
  return (
    <section id="access" className={styles.section}>
      <div className={styles.inner}>
        <Reveal className={styles.panel}>
          <span className={styles.eyebrowRule} aria-hidden="true" />
          <h2 className={styles.heading}>Ready to bring Zentra to MSAT?</h2>
          <p className={styles.sub}>
            One system of record for every learner signal — open your workspace or
            request access for your school.
          </p>
          <div className={styles.actions}>
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#access">Request access</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
