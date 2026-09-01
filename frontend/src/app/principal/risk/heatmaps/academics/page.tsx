import { AcademicHeader } from "./components/AcademicHeader";
import { AcademicInsights } from "./components/AcademicInsights";
import styles from "../components/heatmap.module.css";

export default function PrincipalAcademicHeatmapsPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <section className={styles.page}>
          <AcademicHeader />
          <AcademicInsights />
        </section>
      </div>
    </div>
  );
}
