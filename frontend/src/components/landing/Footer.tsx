import Link from "next/link";
import { Asterisk } from "lucide-react";
import styles from "./Footer.module.css";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link href="#overview" className={styles.brand}>
          <Asterisk size={16} aria-hidden="true" />
          <span>Zentra</span>
        </Link>

        <p className={styles.copy}>
          © {year} Mati School of Arts and Trades · Student Information & Management System
        </p>

        <nav className={styles.links} aria-label="Footer">
          <Link href="#modules" className={styles.link}>
            Modules
          </Link>
          <Link href="#roles" className={styles.link}>
            Roles
          </Link>
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
