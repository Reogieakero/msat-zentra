"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Users, ShieldAlert, Clock, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { fetchInterventionStats } from "../api";
import styles from "./InterventionCarousel.module.css";

interface CarouselCard {
  id: string;
  title: string;
  value: string;
  hint?: string;
  tone: "default" | "warn" | "good";
  icon: React.ComponentType<{ size?: number }>;
}

function buildCards(stats: Awaited<ReturnType<typeof fetchInterventionStats>> | undefined): CarouselCard[] {
  if (!stats) return [];
  return [
    {
      id: "at-risk",
      title: "At-risk students",
      value: String(stats.totalAtRisk),
      hint: "High and Moderate risk",
      tone: stats.totalAtRisk > 0 ? "warn" : "default",
      icon: ShieldAlert,
    },
    {
      id: "interventions",
      title: "With intervention",
      value: String(stats.withIntervention),
      hint: `${stats.totalAtRisk - stats.withIntervention} without plan`,
      tone: "default",
      icon: Users,
    },
    {
      id: "pending",
      title: "Pending approval",
      value: String(stats.pendingApproval),
      hint: "Awaiting review",
      tone: stats.pendingApproval > 0 ? "warn" : "good",
      icon: Clock,
    },
    {
      id: "high-risk",
      title: "High risk",
      value: String(stats.highRisk),
      hint: "Require immediate action",
      tone: stats.highRisk > 0 ? "warn" : "good",
      icon: AlertTriangle,
    },
    {
      id: "ongoing",
      title: "Ongoing",
      value: String(stats.ongoing),
      hint: "Active interventions",
      tone: "default",
      icon: Activity,
    },
    {
      id: "resolved",
      title: "Resolved",
      value: String(stats.resolved),
      hint: "Successfully closed",
      tone: "good",
      icon: CheckCircle2,
    },
  ];
}

export function InterventionCarousel() {
  const { data: stats, isPending } = useQuery({
    queryKey: ["intervention-stats"],
    queryFn: fetchInterventionStats,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const cards = React.useMemo(() => buildCards(stats), [stats]);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={styles.viewport}>
        <div ref={scrollRef} className={styles.track}>
          {isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.card}>
                  <div className={styles.skelIcon} />
                  <div className={styles.skelValue} />
                  <div className={styles.skelLabel} />
                </div>
              ))
            : cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.id}
                    className={`${styles.card} ${card.tone === "warn" ? styles.cardWarn : card.tone === "good" ? styles.cardGood : ""}`}
                  >
                    <span className={styles.cardIcon}>
                      <Icon size={16} />
                    </span>
                    <span className={styles.cardValue}>{card.value}</span>
                    <span className={styles.cardTitle}>{card.title}</span>
                    {card.hint ? <span className={styles.cardHint}>{card.hint}</span> : null}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
