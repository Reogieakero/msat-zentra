import Link from "next/link";
import { Asterisk } from "lucide-react";
import type { Palette } from "./palette";
import styles from "./Nav.module.css";

const links = [
  { href: "#modules", label: "Modules" },
  { href: "#roles", label: "Roles" },
  { href: "#how", label: "Process" },
  { href: "#access", label: "Access" },
];

type NavProps = {
  palette: Palette;
  onPaletteChange: (palette: Palette) => void;
};

export function Nav({ palette, onPaletteChange }: NavProps) {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link href="#overview" className={styles.brand} aria-label="Zentra home">
          <span className={styles.mark} aria-hidden="true">
            <Asterisk size={18} />
          </span>
          <span className={styles.wordmark}>Zentra</span>
        </Link>

        <nav className={styles.links} aria-label="Landing sections">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <div className={styles.palette} role="group" aria-label="Color palette">
            <button
              type="button"
              className={styles.swatch}
              data-palette="mint"
              data-active={palette === "mint"}
              aria-pressed={palette === "mint"}
              aria-label="Mint and violet palette"
              onClick={() => onPaletteChange("mint")}
            >
              <span className={styles.swatchMint} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.swatch}
              data-palette="amber"
              data-active={palette === "amber"}
              aria-pressed={palette === "amber"}
              aria-label="Amber palette"
              onClick={() => onPaletteChange("amber")}
            >
              <span className={styles.swatchAmber} aria-hidden="true" />
            </button>
          </div>

          <Link href="/login" className={styles.signIn}>
            Sign in
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
