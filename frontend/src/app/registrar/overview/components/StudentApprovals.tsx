import Link from "next/link";
import { UserPlus, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import styles from "./student-approvals.module.css";
import type { RegistrarOverviewData } from "./data";

export function StudentApprovals({ data }: { data: RegistrarOverviewData }) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headIcon}>
            <UserPlus className={styles.headIconSvg} />
          </span>
          <h2 className={styles.title}>Student Approvals</h2>
        </div>
        <span className={styles.count}>{data.pendingStudents.length}</span>
      </header>

      {data.pendingStudents.length === 0 ? (
        <p className={styles.emptyState}>No pending student approvals</p>
      ) : (
        <ul className={styles.list}>
          {data.pendingStudents.map((s) => (
            <li key={s.lrn} className={styles.row}>
              <div className={styles.meta}>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.sub}>
                  {s.grade} · LRN {s.lrn}
                </span>
                <span className={styles.parent}>
                  <Clock className={styles.parentIcon} />
                  Parent: {s.parent}
                </span>
              </div>
                <Badge variant="warning">Pending</Badge>
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="outline" size="sm" className={styles.link}>
        <Link href="/registrar/accounts">
          Review all approvals
          <ArrowRight className={styles.linkIcon} />
        </Link>
      </Button>
    </section>
  );
}
