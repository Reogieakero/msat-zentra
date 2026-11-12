import { SectionCardSkeleton } from "./components/SectionCardSkeleton";
import styles from "./components/SectionCardGrid.module.css";

export default function PrincipalAcademicsLoading() {
  return (
    <section aria-label="Loading academics" aria-busy="true" className={styles.wrap}>
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <SectionCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
