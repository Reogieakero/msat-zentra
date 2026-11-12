"use client";

import { Check, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "@/components/providers";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";
import styles from "./settings.module.css";

export default function AdminSettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <section className={styles.page}>
      <ZentraPageHeader
        title="Settings"
        description="Personalise the administrator console."
      />

      <section className={styles.card} aria-labelledby="account-heading">
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 id="account-heading" className={styles.cardTitle}>
              Administrator account
            </h2>
            <p className={styles.cardText}>
              You are signed in with the system administrator role. This account
              is separate from the school desks and can manage accounts and view
              the audit trail.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="appearance-heading">
        <div className={styles.cardHead}>
          <div>
            <h2 id="appearance-heading" className={styles.cardTitle}>
              Appearance
            </h2>
            <p className={styles.cardText}>
              Choose how the console looks on this device.
            </p>
          </div>
        </div>

        <div className={styles.themeGrid} role="group" aria-label="Theme">
          <button
            type="button"
            className={styles.themeOption}
            data-active={isDark ? undefined : "true"}
            aria-pressed={!isDark}
            onClick={() => setTheme("light")}
          >
            <span className={styles.themePreview} data-theme="light" aria-hidden="true">
              <Sun size={18} />
            </span>
            <span className={styles.themeLabel}>
              Light
              {!isDark ? <Check size={14} aria-hidden="true" /> : null}
            </span>
          </button>

          <button
            type="button"
            className={styles.themeOption}
            data-active={isDark ? "true" : undefined}
            aria-pressed={isDark}
            onClick={() => setTheme("dark")}
          >
            <span className={styles.themePreview} data-theme="dark" aria-hidden="true">
              <Moon size={18} />
            </span>
            <span className={styles.themeLabel}>
              Dark
              {isDark ? <Check size={14} aria-hidden="true" /> : null}
            </span>
          </button>
        </div>
      </section>
    </section>
  );
}
