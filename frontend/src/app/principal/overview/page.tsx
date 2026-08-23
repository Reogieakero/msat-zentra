import styles from "./overview.module.css";

export default function PrincipalOverviewPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Principal Overview</h1>
      <p className={styles.lead}>
        This is a placeholder page. Principal login redirects here on success.
      </p>
    </section>
  );
}
