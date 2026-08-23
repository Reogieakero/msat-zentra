"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FluidBackground, type FluidHue } from "@/components/auth/FluidBackground";
import { FluidColorPicker } from "@/components/auth/FluidColorPicker";
import styles from "./login.module.css";

export function LoginHeader() {
  const [hue, setHue] = React.useState<FluidHue>("green");

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
