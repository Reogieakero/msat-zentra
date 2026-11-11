"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Asterisk,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ScrollField } from "@/components/landing/ScrollField";
import type { Palette } from "@/components/landing/palette";
import styles from "./AuthShell.module.css";

type AuthRole = "student" | "staff" | "parent" | "admin";

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
  admin: {
    title: "System administration",
    items: [
      "Manage account access and staff provisioning.",
      "Monitor desks and system-wide activity.",
      "Keep the school's records and roles in order.",
    ],
  },
};

const ROLE_ICONS: Record<AuthRole, LucideIcon> = {
  student: GraduationCap,
  staff: Briefcase,
  parent: Users,
  admin: ShieldCheck,
};

interface AuthShellProps {
  role: AuthRole;
  children: React.ReactNode;
}

export function AuthShell({ role, children }: AuthShellProps) {
  const content = BROWSER_CONTENT[role];
  const Icon = ROLE_ICONS[role];
  const [palette, setPalette] = useState<Palette>("mint");

  return (
    <main className={`${styles.shell} dark`} data-palette={palette}>
      <ScrollField palette={palette} autoCycle align="topRight" />

      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand} aria-label="Zentra home">
            <span className={styles.mark} aria-hidden="true">
              <Asterisk size={18} />
            </span>
            <span className={styles.wordmark}>Zentra</span>
          </Link>

          <div className={styles.navActions}>
            <div className={styles.palette} role="group" aria-label="Color palette">
              <button
                type="button"
                className={styles.swatch}
                data-active={palette === "mint"}
                aria-pressed={palette === "mint"}
                aria-label="Mint and violet palette"
                onClick={() => setPalette("mint")}
              >
                <span className={styles.swatchMint} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.swatch}
                data-active={palette === "amber"}
                aria-pressed={palette === "amber"}
                aria-label="Amber palette"
                onClick={() => setPalette("amber")}
              >
                <span className={styles.swatchAmber} aria-hidden="true" />
              </button>
            </div>

            <Link href="/login" className={styles.switchBtn}>
              Choose account
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.stage}>
        <section className={styles.panel}>
          <div className={styles.formWrap}>{children}</div>
          <p className={styles.footer}>Mati School of Arts and Trades</p>
        </section>

        <aside className={styles.aside}>
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <span className={styles.dots} aria-hidden="true">
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </span>
              <span className={styles.browserUrl}>msat.edu/zentra</span>
            </div>
            <div className={styles.browserBody}>
              <span className={styles.asideIcon}>
                <Icon size={24} />
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
      </div>
    </main>
  );
}
