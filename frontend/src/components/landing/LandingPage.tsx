import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Modules } from "./Modules";
import { HowItWorks } from "./HowItWorks";
import { Stats } from "./Stats";
import { FooterCta } from "./FooterCta";
import { Footer } from "./Footer";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Nav />
        <Hero />
        <Modules />
        <HowItWorks />
        <Stats />
        <FooterCta />
        <Footer />
      </div>
    </main>
  );
}

