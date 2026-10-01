'use client';

import * as React from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import "./reminder-stack.css";

interface StackEntry {
  id: string;
}

function CardRotate({
  children,
  onSendToBack,
  sensitivity,
}: {
  children: React.ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number; y: number } }
  ) {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className="rb-card-rotate"
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: "grabbing" }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  );
}

/* React-Bits-style stacked deck (motion springs, drag-to-cycle):
   the TOP entry renders in normal flow and sizes the pile; the rest sit
   absolutely behind it, fanned by rotation. `order` runs bottom → top. */
export function ReminderStack({
  ids,
  renderCard,
  sensitivity = 180,
  onCycle,
}: {
  ids: string[];
  renderCard: (id: string, isTop: boolean) => React.ReactNode;
  sensitivity?: number;
  onCycle?: (cycledId: string) => void;
}) {
  // Visual order, bottom → top: newcomers land on top, handled-away ids
  // leave the pile. Synced during render, guarded by the joined key so it
  // runs once per id-set change. Straight deck — no rotation; depth reads
  // through vertical offset + scale in the render below.
  const [order, setOrder] = React.useState<StackEntry[]>([]);
  const [prevKey, setPrevKey] = React.useState<string>("");
  const idsKey = ids.join("|");
  if (prevKey !== idsKey) {
    setPrevKey(idsKey);
    setOrder((prev) => {
      const prevIds = new Set(prev.map((e) => e.id));
      const kept = prev.filter((e) => ids.includes(e.id));
      const fresh = ids
        .filter((id) => !prevIds.has(id))
        .map((id) => ({ id }));
      return [...kept, ...fresh];
    });
  }
  const entries = order;

  const sendToBack = React.useCallback(
    (id: string) => {
      setOrder((prev) => {
        const index = prev.findIndex((card) => card.id === id);
        if (index <= 0) return prev;
        const next = [...prev];
        const [card] = next.splice(index, 1);
        next.unshift(card);
        return next;
      });
      onCycle?.(id);
    },
    [onCycle]
  );

  if (entries.length === 0) return null;
  const topId = entries[entries.length - 1].id;

  return (
    <div className="rb-stack-container">
      {entries.map((card, index) => {
        const isTop = card.id === topId;
        return (
          <div
            key={card.id}
            className={isTop ? "rb-stack-top" : "rb-stack-behind"}
            aria-hidden={!isTop}
          >
            <CardRotate
              onSendToBack={() => sendToBack(card.id)}
              sensitivity={sensitivity}
            >
            <motion.div
              className="rb-card"
              onClick={() => sendToBack(card.id)}
              animate={{
                rotateZ: 0,
                y: (entries.length - index - 1) * 14,
                scale: 1 - (entries.length - index - 1) * 0.03,
                transformOrigin: "50% 0%",
              }}
              initial={false}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {renderCard(card.id, isTop)}
            </motion.div>
            </CardRotate>
          </div>
        );
      })}
    </div>
  );
}
