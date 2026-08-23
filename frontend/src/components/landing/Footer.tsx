import Link from "next/link";
import { Reveal } from "./Reveal";
import styles from "./Footer.module.css";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <Reveal className={styles.inner}>
        <p className={styles.copy}>
          © {year} Zentra · Mati School of Arts and Trades
        </p>
        <nav className={styles.links} aria-label="Footer">
          <Link href="#privacy" className={styles.link}>
            Privacy
          </Link>
          <Link href="#access" className={styles.link}>
            Access request
          </Link>
        </nav>
      </Reveal>
    </footer>
  );
}
