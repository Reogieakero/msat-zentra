"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { CalendarCheck, BookOpen, Star, Flame, Medal, type LucideIcon } from "lucide-react";
import type { AwardCategory } from "../honor-roll-data";
import styles from "./AwardCategories.module.css";

interface Props {
  awards: AwardCategory[];
  onSelect?: (award: AwardCategory) => void;
}

const ICONS: Record<AwardCategory["icon"], LucideIcon> = {
  calendar: CalendarCheck,
  book: BookOpen,
  star: Star,
  flame: Flame,
  medal: Medal,
};

export function AwardCategories({ awards, onSelect }: Props) {
  return (
    <Card className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Award Categories</h2>
        <p className={styles.sub}>
          School-defined recognitions — placeholders for this term
        </p>
      </div>

      <div className={styles.grid}>
        {awards.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <button
              key={a.id}
              type="button"
              className={styles.card}
              onClick={() => onSelect?.(a)}
            >
              <span className={styles.iconBox}>
                <Icon className={styles.icon} aria-hidden />
              </span>
              <h3 className={styles.cardTitle}>{a.title}</h3>
              <p className={styles.cardDesc}>{a.description}</p>
              <span className={styles.basis}>Basis: {a.basis}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
