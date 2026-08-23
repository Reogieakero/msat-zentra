import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FluidBackground } from "@/components/auth/FluidBackground";
import styles from "./AuthShell.module.css";

type AuthRole = "student" | "staff" | "parent";

const BROWSER_CONTENT: Record<
  AuthRole,
  { title: string; items: string[] }
> = {
  student: {
    title: "Your learner workspace",
    items: [
      "View grades and final transmuted marks per term.",
      "Track attendance and absence at a glance.",
      "See your risk level and learner records.",
    ],
  },
  parent: {
    title: "Stay close to your child",
    items: [
      "Follow your child's grades and attendance.",
      "Get updates from teachers and guidance.",
      "View learner records and intervention notes.",
    ],
  },
  staff: {
    title: "Your staff workspace",
    items: [
      "Encode grades and lock finals for registrar approval.",
      "Take AM/PM attendance and write anecdotal records.",
      "Track ADM learners and refer at-risk students.",
    ],
  },
};

interface AuthShellProps {
  icon: LucideIcon;
  role: AuthRole;
  children: React.ReactNode;
}

export function AuthShell({ icon: Icon, role, children }: AuthShellProps) {
  const content = BROWSER_CONTENT[role];

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            Zentra
          </Link>
          <Button asChild variant="ghost" size="sm" className={styles.switchBtn}>
            <Link href="/login">Choose account</Link>
          </Button>
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
        <div className={styles.browser}>
          <div className={styles.browserBar}>
            <span className={styles.dots} aria-hidden>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
            <span className={styles.browserUrl}>msat.edu/zentra</span>
          </div>
          <div className={styles.browserBody}>
            <span className={styles.asideIcon}>
              <Icon size={26} />
            </span>
            <h2 className={styles.browserTitle}>{content.title}</h2>
            <ul className={styles.asideList}>
              {content.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}
