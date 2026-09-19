"use client";

import * as React from "react";
import { gsap } from "gsap";
import "./CardSwap.css";

export interface CardSwapProps {
  width?: number | string;
  height?: number | string;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onCardClick?: (idx: number) => void;
  skewAmount?: number;
  easing?: "linear" | "elastic";
  className?: string;
  children: React.ReactNode;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { customClass, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={`card-swap-card ${customClass ?? ""} ${className ?? ""}`.trim()}
    />
  );
});
Card.displayName = "Card";

interface Slot {
  x: number;
  y: number;
  z: number;
  zIndex: number;
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
});

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: "center center",
    zIndex: slot.zIndex,
    force3D: true,
  });

/**
 * CardSwap — ReactBits-style stacked card deck. Cards cycle front-to-back
 * on a timer with a GSAP elastic (or linear) motion. The deck is centered
 * in its parent (margin-inline auto); give the parent a fixed height and
 * `overflow: visible` so the drop animation can play.
 */
export function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = "elastic",
  className,
  children,
}: CardSwapProps) {
  const config =
    easing === "elastic"
      ? {
          ease: "elastic.out(0.6,0.9)",
          durDrop: 2,
          durMove: 2,
          durReturn: 2,
          promoteOverlap: 0.9,
          returnDelay: 0.05,
        }
      : {
          ease: "power1.inOut",
          durDrop: 0.8,
          durMove: 0.8,
          durReturn: 0.8,
          promoteOverlap: 0.45,
          returnDelay: 0.2,
        };

  const childArr = React.useMemo(
    () => React.Children.toArray(children) as React.ReactElement<CardProps>[],
    [children]
  );
  const count = childArr.length;

  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const order = React.useRef<number[]>([]);
  const tlRef = React.useRef<gsap.core.Timeline | null>(null);
  const intervalRef = React.useRef<number>(0);
  const container = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Keep the cycling order in sync with the number of cards.
    if (order.current.length !== count) {
      order.current = Array.from({ length: count }, (_, i) => i);
    }
    const els = refs.current.slice(0, count);
    if (els.some((el) => el === null)) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    els.forEach((el, i) =>
      placeNow(el as HTMLElement, makeSlot(i, cardDistance, verticalDistance, count), skewAmount)
    );

    // Static fanned stack when there is nothing to cycle or the user
    // prefers reduced motion.
    if (els.length < 2 || reduced) return;

    const swap = () => {
      if (order.current.length < 2) return;
      const [front, ...rest] = order.current;
      const elFront = refs.current[front];
      if (!elFront) return;
      const tl = gsap.timeline();
      tlRef.current = tl;

      tl.to(elFront, { y: "+=500", duration: config.durDrop, ease: config.ease });
      tl.addLabel("promote", `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = refs.current[idx];
        if (!el) return;
        const slot = makeSlot(i, cardDistance, verticalDistance, count);
        tl.set(el, { zIndex: slot.zIndex }, "promote");
        tl.to(
          el,
          { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
          `promote+=${i * 0.15}`
        );
      });

      const backSlot = makeSlot(count - 1, cardDistance, verticalDistance, count);
      tl.addLabel("return", `promote+=${config.durMove * config.returnDelay}`);
      tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, "return");
      tl.to(
        elFront,
        { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease },
        "return"
      );
      tl.call(() => {
        order.current = [...rest, front];
      });
    };

    intervalRef.current = window.setInterval(swap, delay);

    const node = container.current;
    if (pauseOnHover && node) {
      const pause = () => {
        tlRef.current?.pause();
        window.clearInterval(intervalRef.current);
      };
      const resume = () => {
        tlRef.current?.play();
        intervalRef.current = window.setInterval(swap, delay);
      };
      node.addEventListener("mouseenter", pause);
      node.addEventListener("mouseleave", resume);
      return () => {
        node.removeEventListener("mouseenter", pause);
        node.removeEventListener("mouseleave", resume);
        window.clearInterval(intervalRef.current);
        tlRef.current?.kill();
      };
    }
    return () => {
      window.clearInterval(intervalRef.current);
      tlRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing]);

  const rendered = childArr.map((child, i) =>
    React.isValidElement<CardProps>(child)
      ? React.cloneElement(
          child as React.ReactElement<CardProps & { ref?: React.Ref<HTMLDivElement> }>,
          {
            key: i,
            ref: (el: HTMLDivElement | null) => {
              refs.current[i] = el;
            },
            style: { width, height, ...(child.props.style ?? {}) },
            onClick: (e: React.MouseEvent<HTMLDivElement>) => {
              child.props.onClick?.(e);
              onCardClick?.(i);
            },
          }
        )
      : child
  );

  return (
    <div
      ref={container}
      className={`card-swap ${className ?? ""}`.trim()}
      style={{ width, height }}
    >
      {rendered}
    </div>
  );
}

export default CardSwap;
