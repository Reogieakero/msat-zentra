"use client";

import * as React from "react";
import { getCursor, subscribeAim } from "./cursor-tracker";

/**
 * Cursor-watching aim for StudentMascot, ported from the page-mascot
 * library (nilbuild/page-mascot, MIT): the pointer's angle picks a cell
 * on the 3x3 directions sheet, with a dead zone so the head settles when
 * the cursor is close, and hysteresis so it holds a sector until the
 * pointer is well past its edge.
 *
 * Tracking switches off without a fine pointer (touch stays centered)
 * and under prefers-reduced-motion (static).
 */

// Row-major sheet order: up-left, up, up-right, left, center, right,
// down-left, down, down-right.
const DIRECTION_FRAME: Record<string, number> = {
  "up-left": 0,
  up: 1,
  "up-right": 2,
  left: 3,
  center: 4,
  right: 5,
  "down-left": 6,
  down: 7,
  "down-right": 8,
};

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
] as const;

const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE = 70;
const CENTER_FRAME = 4;

function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Frame index into the directions sheet for the given element. */
export function useMascotAim(
  targetRef: React.RefObject<HTMLElement | null>,
): number {
  const [frame, setFrame] = React.useState(CENTER_FRAME);
  const sectorRef = React.useRef(-1);

  React.useEffect(() => {
    if (
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const aim = () => {
      const el = targetRef.current;
      const cursor = getCursor();
      if (!el || !cursor) return;

      const box = el.getBoundingClientRect();
      const dx = cursor.x - (box.left + box.width / 2);
      const dy = cursor.y - (box.top + box.height / 2);

      if (Math.hypot(dx, dy) < DEAD_ZONE) {
        if (sectorRef.current !== -1) {
          sectorRef.current = -1;
          setFrame(CENTER_FRAME);
        }
        return;
      }

      // Hold the current sector until the pointer is well past its edge.
      const angle = Math.atan2(dy, dx);
      if (
        sectorRef.current !== -1 &&
        Math.abs(wrap(angle - sectorRef.current * SECTOR)) <
          SECTOR / 2 + HYSTERESIS
      ) {
        return;
      }

      const sector =
        (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
      sectorRef.current = sector;
      setFrame(DIRECTION_FRAME[CLOCKWISE[sector]!] ?? CENTER_FRAME);
    };

    aim();
    return subscribeAim(aim);
  }, [targetRef]);

  return frame;
}
