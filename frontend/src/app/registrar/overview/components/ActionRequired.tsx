import { UserCheck, ShieldQuestion, FileCheck2 } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import styles from "./action-required.module.css";
import type { RegistrarOverviewData } from "./data";

const ETHER = {
  colors: ["#e8f6ee", "#bfe6cf", "#7fc9a3"],
  lightMode: true,
  mouseForce: 10,
  cursorSize: 50,
  autoSpeed: 0.6,
  autoIntensity: 1.6,
};

export function ActionRequired({ data }: { data: RegistrarOverviewData }) {
  return (
    <section className={styles.wrap}>
      <h2 className={styles.heading}>Action Required</h2>
      <div className={styles.kpiGrid}>
        <KpiCard
          background="liquidEther"
          liquidEtherProps={ETHER}
          icon={<UserCheck />}
          value={data.pendingAccounts}
          label="Pending accounts (G11–12)"
          href="/registrar/accounts"
        />
        <KpiCard
          background="liquidEther"
          liquidEtherProps={ETHER}
          icon={<ShieldQuestion />}
          value={data.pendingAdviserAccess}
          label="Adviser access requests"
          href="/registrar/adviser-access"
        />
        <KpiCard
          background="liquidEther"
          liquidEtherProps={ETHER}
          icon={<FileCheck2 />}
          value={data.lockedFinalsAwaiting}
          label="Locked finals awaiting approval"
          href="/registrar/final-grades"
        />
      </div>
    </section>
  );
}
