import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Modules } from "./Modules";
import { HowItWorks } from "./HowItWorks";
import { DesignApproach } from "./DesignApproach";
import styles from "./LandingPage.module.css";

export function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Nav />
        <Hero />
        <Modules />
        <HowItWorks />
        <DesignApproach />
      </div>
    </main>
  );
}

