import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import styles from "./RoleCard.module.css";

interface RoleCardProps {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export function RoleCard({ href, label, description, icon: Icon }: RoleCardProps) {
  return (
    <Link href={href} className={styles.card}>
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.description}>{description}</span>
      <button type="button" className={styles.continue}>
        Continue
        <ChevronRight size={14} className={styles.chevron} />
      </button>
    </Link>
  );
}
