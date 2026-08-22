import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./Nav.module.css";

export function Nav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="#overview" className={styles.brand}>
          <span className={styles.wordmark}>Zentra</span>
        </Link>

        <div className={styles.actions}>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="#cta">Request access</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
