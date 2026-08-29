import { Users, FileBarChart, GraduationCap } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import styles from "./academics-kpis.module.css";
import type { RegistrarOverviewData } from "./data";

const ETHER = {
  colors: ["#e8f6ee", "#bfe6cf", "#7fc9a3"],
  lightMode: true,
  mouseForce: 10,
  cursorSize: 50,
  autoSpeed: 0.6,
  autoIntensity: 1.6,
};

export function AcademicsKpis({ data }: { data: RegistrarOverviewData }) {
  return (
    <section className={`${styles.card} ${styles.railCard}`}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Academics (G11–12)</h2>
      </header>
      <div className={styles.cardBody}>
        <div className={styles.kpiGrid}>
          <KpiCard
            background="liquidEther"
            liquidEtherProps={ETHER}
            icon={<Users />}
            value={data.sections}
            label="Sections"
            href="/registrar/academics"
          />
          <KpiCard
            background="liquidEther"
            liquidEtherProps={ETHER}
            icon={<FileBarChart />}
            value={data.subjects}
            label="Subjects"
            href="/registrar/academics"
          />
          <KpiCard
            background="liquidEther"
            liquidEtherProps={ETHER}
            icon={<GraduationCap />}
            value={data.reportCards}
            label="Report cards"
            href="/registrar/report-cards"
          />
        </div>
      </div>
    </section>
  );
}
