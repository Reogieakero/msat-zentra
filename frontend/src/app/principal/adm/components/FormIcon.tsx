import * as React from "react";
import {
  FileText,
  ScrollText,
  Award,
  ClipboardList,
  Home,
  CheckCircle2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import styles from "./admFormIcon.module.css";

type FormKind = "REFERRAL_FORM" | "ANECDOTAL_REPORT" | "CERTIFICATION" | "MINUTES_OF_MEETING" | "HV_FORM";

const FORM_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  REFERRAL_FORM: { label: "Referral", color: "#ffc371", Icon: FileText },
  ANECDOTAL_REPORT: { label: "Anecdotal", color: "#4facfe", Icon: ScrollText },
  CERTIFICATION: { label: "Certification", color: "#00f2fe", Icon: Award },
  MINUTES_OF_MEETING: { label: "Minutes", color: "#a18cd1", Icon: ClipboardList },
  HV_FORM: { label: "Home Visit", color: "#ff5f6d", Icon: Home },
};

const STATUS: Record<string, { label: string; cls: string; Icon: LucideIcon; show: boolean }> = {
  verified: { label: "Verified", cls: "verified", Icon: CheckCircle2, show: true },
  submitted: { label: "Submitted", cls: "submitted", Icon: UploadCloud, show: true },
  pending: { label: "Pending", cls: "pending", Icon: CheckCircle2, show: false },
};

export function FormIcon({
  formType,
  title,
  status,
  index = 0,
}: {
  formType: string;
  title: string;
  status: string;
  index?: number;
}) {
  const meta = FORM_META[formType] ?? { label: title, color: "var(--primary)", Icon: FileText };
  const st = STATUS[status] ?? STATUS.pending;
  const StatusIcon = st.Icon;
  return (
    <span
      className={styles.formIcon}
      style={
        {
          ["--doc-color"]: meta.color,
          animationDelay: `${Math.min(index, 12) * 70}ms`,
        } as React.CSSProperties
      }
      title={`${meta.label}${st.show ? ` — ${st.label}` : ""}`}
    >
      <span className={styles.sheet}>
        <meta.Icon className={styles.glyph} aria-hidden />
        {st.show && (
          <span className={`${styles.statusDot} ${styles[st.cls]}`}>
            <StatusIcon className={styles.statusGlyph} aria-hidden />
          </span>
        )}
      </span>
      <span className={styles.caption}>{meta.label}</span>
    </span>
  );
}
