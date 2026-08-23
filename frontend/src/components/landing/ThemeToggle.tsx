"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={
        mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"
      }
      title={
        mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun
        size={16}
        className={`${styles.icon} ${styles.sun} ${
          mounted && isDark ? styles.hidden : ""
        }`}
        aria-hidden="true"
      />
      <Moon
        size={16}
        className={`${styles.icon} ${styles.moon} ${
          mounted && !isDark ? styles.hidden : ""
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
