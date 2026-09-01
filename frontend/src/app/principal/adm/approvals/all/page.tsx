import { ApprovalsBoard } from "./ApprovalsBoard";
import styles from "./all.module.css";
import header from "../../components/AdmHeader.module.css";

export default function PrincipalAdmApprovalsAllPage() {
  return (
    <section className={styles.page}>
      <div className={header.headerRow}>
        <div className={`${header.headerText} ${styles.headerText}`}>
          <h1 className={header.headerTitle}>ADM Approvals</h1>
          <p className={header.headerSub}>
            Every final-signed learner profile — open a folder to review the
            bundled documents per student.
          </p>
        </div>
      </div>
      <ApprovalsBoard />
    </section>
  );
}
