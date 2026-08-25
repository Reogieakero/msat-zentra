import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, UserCheck, CalendarX, Award, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OverviewData } from "./data";
import styles from "./action-required.module.css";

type ActionCard = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  cta: string;
  featured?: boolean;
  image?: string;
  description?: string;
};

export function ActionRequired({ data }: { data: OverviewData | null }) {
  const router = useRouter();
  const pendingSignatures = data?.admPending ?? 0;
  const accountApprovals = data?.accountApprovals ?? 0;
  const attendanceWatch = data?.attendanceWatch ?? 0;

  const riskStudents = data?.atRisk ? data.atRisk.students : 0;

  const honorRoll = data?.honorRoll ?? 0;

  const cards: ActionCard[] = [
    {
      key: "adm",
      icon: FileSignature,
      title: "ADM Signatures",
      count: pendingSignatures,
      href: "/principal/adm",
      cta: "Review signatures",
      featured: true,
      image:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80",
      description:
        "Alternate Delivery Mode learner profiles prepared by the ADM Coordinator are queued for your final digital signature before release.",
    },
    {
      key: "accounts",
      icon: UserCheck,
      title: "Pending Account Approvals",
      count: accountApprovals,
      href: "/principal/overview",
      cta: "Review accounts",
      image:
        "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
    },
    {
      key: "attendance",
      icon: CalendarX,
      title: "Attendance Watch",
      count: attendanceWatch,
      href: "/principal/risk",
      cta: "View sections",
      image:
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80",
    },
    {
      key: "honor",
      icon: Award,
      title: "Honor Roll",
      count: honorRoll,
      href: "/principal/academics",
      cta: "View honor roll",
      image:
        "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80",
    },
    {
      key: "risk",
      icon: ShieldAlert,
      title: "At-Risk Students",
      count: riskStudents,
      href: "/principal/risk",
      cta: "View at-risk",
      image:
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const Card = (c: ActionCard) => {
    const Icon = c.icon;
    const empty = c.count === 0;
    return (
      <Button
        type="button"
        variant="default"
        key={c.key}
        onClick={() => router.push(c.href)}
        className={`${styles.card}${c.featured || c.image ? ` ${styles.withImage}` : ""}`}
        style={
          c.image
            ? {
                backgroundImage: `linear-gradient(135deg, color-mix(in oklch, #0b0c0e, transparent 12%), color-mix(in oklch, #0b0c0e, transparent 38%)), url(${c.image})`,
              }
            : undefined
        }
        aria-label={empty ? `${c.title}: all caught up` : `${c.title}: ${c.count} pending`}
      >
        <span className={styles.icon}>
          <Icon className={styles.iconSvg} aria-hidden />
        </span>
        <span className={styles.count}>{c.count}</span>
        <span className={styles.cardTitle}>{c.title}</span>
        {c.description ? (
          <span className={styles.description}>{c.description}</span>
        ) : null}
        <span className={styles.cta}>
          {empty ? "View" : c.cta}
          <ArrowRight className={styles.ctaIcon} aria-hidden />
        </span>
      </Button>
    );
  };

  const featured = cards.find((c) => c.featured);
  const others = cards.filter((c) => !c.featured);

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Action Required</h3>
      <div className={styles.grid}>
        <div className={styles.featuredCol}>{featured && Card(featured)}</div>
        <div className={styles.rightCol}>
          {others.map((c) => Card(c))}
        </div>
      </div>
    </section>
  );
}
