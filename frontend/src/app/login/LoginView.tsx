"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Asterisk, Briefcase, GraduationCap, Users } from "lucide-react";
import { ScrollField } from "@/components/landing/ScrollField";
import type { Palette } from "@/components/landing/palette";
import styles from "./login.module.css";

const ROLE_OPTIONS = [
  {
    href: "/login/students",
    label: "Student",
    description: "Check your grades, attendance, and learner record.",
    icon: GraduationCap,
  },
  {
    href: "/login/staff",
    label: "Staff",
    description: "Teachers, advisers, guidance, health, and school leadership.",
    icon: Briefcase,
  },
  {
    href: "/login/parents",
    label: "Parent / Guardian",
    description: "Follow your child's grades, attendance, and school updates.",
    icon: Users,
  },
];

export function LoginView() {
  const [palette, setPalette] = useState<Palette>("mint");

  return (
    <main className={styles.page} data-palette={palette}>
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

            <Link href="/" className={styles.home}>
              Back to site
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.stage}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Mati School of Arts and Trades
          </p>

          <h1 className={styles.title}>
            Sign in to <span className={styles.titleAccent}>Zentra</span>
          </h1>

          <p className={styles.lede}>
            Pick the account that matches your role. The next step asks for your
            school email and password.
          </p>

          <ul className={styles.roles}>
            {ROLE_OPTIONS.map((option, index) => {
              const Icon = option.icon;
              return (
                <li key={option.href}>
                  <Link
                    href={option.href}
                    className={styles.role}
                    style={{ ["--role-delay" as string]: `${120 + index * 90}ms` }}
                  >
                    <span className={styles.roleIndex} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.roleIcon} aria-hidden="true">
                      <Icon size={19} />
                    </span>
                    <span className={styles.roleText}>
                      <span className={styles.roleLabel}>{option.label}</span>
                      <span className={styles.roleDescription}>
                        {option.description}
                      </span>
                    </span>
                    <span className={styles.roleCta}>
                      <span className={styles.roleCtaText}>Continue</span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className={styles.footnote}>
            Need an account? Students can{" "}
            <Link href="/register" className={styles.footnoteLink}>
              create one here
            </Link>
            . Staff and parents can ask the school administrator for access.
          </p>
        </section>

        <aside className={styles.aside}>
          <div className={styles.panel}>
            <p className={styles.panelLabel}>At a glance</p>
            <p className={styles.panelTitle}>
              One learner record, read by every desk.
            </p>
            <dl className={styles.stats}>
              <div className={styles.stat}>
                <dt>Workspaces</dt>
                <dd>10</dd>
              </div>
              <div className={styles.stat}>
                <dt>Terms / year</dt>
                <dd>3</dd>
              </div>
              <div className={styles.stat}>
                <dt>Grade levels</dt>
                <dd>7–12</dd>
              </div>
            </dl>
            <p className={styles.panelNote}>
              Grades, attendance, and support notes stay in sync, so nothing waits
              for the end of the term.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
