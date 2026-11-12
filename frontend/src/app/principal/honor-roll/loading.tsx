import { HonorRollSkeleton } from "./components/HonorRollSkeleton";
import styles from "./honor-roll.module.css";

export default function PrincipalHonorRollLoading() {
  return (
    <section
      className={styles.page}
      aria-label="Loading honor roll"
      aria-busy="true"
    >
      <HonorRollSkeleton />
    </section>
  );
}
