"use client";

import { useState } from "react";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Modules } from "./Modules";
import { HowItWorks } from "./HowItWorks";
import { Roles } from "./Roles";
import { Stats } from "./Stats";
import { FooterCta } from "./FooterCta";
import { Footer } from "./Footer";
import { ScrollField } from "./ScrollField";
import type { Palette } from "./palette";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  const [palette, setPalette] = useState<Palette>("mint");

  return (
    <main className={styles.page} data-palette={palette}>
      <ScrollField palette={palette} />
      <Nav palette={palette} onPaletteChange={setPalette} />
      <div className={styles.content}>
        <Hero palette={palette} />
        <Modules />
        <HowItWorks />
        <Roles />
        <Stats />
        <FooterCta />
        <Footer />
      </div>
    </main>
  );
}
