"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FluidBackground } from "@/components/auth/FluidBackground";
import { FluidColorPicker } from "@/components/auth/FluidColorPicker";
import { useFluidHue } from "@/lib/auth/useFluidHue";
import styles from "./login.module.css";

export function LoginHeader() {
  const [hue, setHue] = useFluidHue();

  return (
    <>
      <FluidBackground hue={hue} />
      <div className={styles.scrim} aria-hidden />
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          Zentra
        </Link>
        <div className={styles.headerActions}>
          <FluidColorPicker value={hue} onChange={setHue} />
          <Button asChild variant="default" size="sm" className={styles.homeBtn}>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </header>
    </>
  );
}
