import * as React from "react";
import { FileCheck2, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdviserAccessRequest, AffectedAdvisee } from "./types";
import styles from "./advisee-panel.module.css";

type Props = {
  request: AdviserAccessRequest | null;
  onClose?: () => void;
};

export function AdviseePanel({ request, onClose }: Props) {
  if (!request) {
    return (
      <div className={styles.empty}>
        <Users className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          Select “View advisees” on a request to see the affected learners here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headIcon}>
            <FileCheck2 className={styles.headIconSvg} />
          </span>
          <div>
            <h2 className={styles.title}>Affected Advisees</h2>
            <p className={styles.sub}>
              {request.adviserName} · {request.section}
            </p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close panel"
            onClick={onClose}
          >
            <X className={styles.closeIcon} />
          </button>
        ) : null}
      </header>

      <div className={styles.scope}>
        <Badge variant="outline">SF10 read · {request.gradeLevel}</Badge>
        <Badge variant="outline">{request.affectedAdvisees.length} learners</Badge>
      </div>

      <ul className={styles.list}>
        {request.affectedAdvisees.map((a) => (
          <AdviseeRow key={a.lrn} advisee={a} />
        ))}
      </ul>
    </div>
  );
}

function AdviseeRow({ advisee }: { advisee: AffectedAdvisee }) {
  return (
    <li className={styles.item}>
      <div className={styles.identity}>
        <span className={styles.name}>{advisee.name}</span>
        <span className={styles.lrn}>{advisee.lrn}</span>
      </div>
      <div className={styles.meta}>
        <span className={styles.grade}>{advisee.gradeLevel}</span>
        <Sf10Badge status={advisee.sf10Status} />
      </div>
    </li>
  );
}

function Sf10Badge({ status }: { status: AffectedAdvisee["sf10Status"] }) {
  if (status === "validated")
    return <Badge variant="default" className={styles.sf10Validated}>Validated</Badge>;
  if (status === "verified")
    return <Badge variant="secondary">Verified</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}
