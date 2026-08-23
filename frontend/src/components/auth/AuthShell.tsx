import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { FluidBackground } from "@/components/auth/FluidBackground";
import styles from "./AuthShell.module.css";

interface AuthShellProps {
  icon: LucideIcon;
  children: React.ReactNode;
}

export function AuthShell({ icon: Icon, children }: AuthShellProps) {
  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            Zentra
          </Link>
          <ThemeToggle />
        </header>

        <div className={styles.body}>
          <div className={styles.formWrap}>{children}</div>
        </div>

        <footer className={styles.footer}>
          Mati School of Arts and Trades
        </footer>
      </div>

      <aside className={styles.aside}>
        <FluidBackground />
        <div className={styles.asideScrim} aria-hidden />
        <div className={styles.asideContent}>
          <span className={styles.asideIcon}>
            <Icon size={26} />
          </span>
          <h2 className={styles.asideTitle}>
            One record, every learner signal.
          </h2>
          <p className={styles.asideText}>
            Grading, attendance, anecdotal records, and early-intervention risk —
            unified for the whole school community.
          </p>
          <ul className={styles.asideList}>
            <li>Encode grades and lock finals for registrar approval.</li>
            <li>Take AM/PM attendance and write anecdotal records.</li>
            <li>Track ADM learners and refer at-risk students.</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
