"use client";

import * as React from "react";
import Link from "next/link";
import styles from "./BranchedMenu.module.css";

export interface BranchedMenuChild {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** When set, the row navigates instead of acting as a plain button. */
  href?: string;
}

export interface BranchedMenuItem {
  label: string;
  value?: string;
  href?: string;
  children?: BranchedMenuChild[];
}

type OpenState = number | number[];

const PAD = 6;
const MARK = 16;

function toSet(open: OpenState): Set<number> {
  return new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);
}

interface BranchedMenuProps {
  items?: BranchedMenuItem[];
  defaultOpen?: OpenState;
  defaultActive?: string;
  /** Controlled active value (e.g. the current route). Follows changes and
   *  auto-opens the containing section. */
  activeValue?: string;
  onSelect?: (value: string, item: BranchedMenuChild | BranchedMenuItem) => void;
  onToggle?: (index: number, open: boolean) => void;
  color?: string;
  accentColor?: string;
  lineColor?: string;
  width?: number;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
  drawDuration?: number;
  foldDuration?: number;
  className?: string;
}

/* BranchedMenu (reactbits) ported to TypeScript + CSS modules. Section
   headers fold; children branch out along animated SVG lines with a
   travelling accent marker. Icons accept any React node (lucide
   elements work directly). */
export default function BranchedMenu({
  items = [],
  defaultOpen = 0,
  defaultActive = '',
  activeValue,
  onSelect,
  onToggle,
  color = "var(--foreground)",
  accentColor = "var(--primary)",
  lineColor = "var(--border)",
  width = 240,
  rowHeight = 36,
  indent = 40,
  trunk = 14,
  radius = 10,
  lineWidth = 1.5,
  fontSize = 14,
  drawDuration = 400,
  foldDuration = 300,
  className = "",
}: BranchedMenuProps) {
  const [open, setOpen] = React.useState<Set<number>>(() => toSet(defaultOpen));
  const [active, setActive] = React.useState(() => {
    if (defaultActive) return defaultActive;
    const first = items.find((it, i) => it.children && toSet(defaultOpen).has(i));
    return first?.children?.[0]?.value ?? "";
  });
  const navRef = React.useRef<HTMLElement | null>(null);
  const heads = React.useRef<(HTMLElement | null)[]>([]);
  const markerRef = React.useRef<HTMLSpanElement | null>(null);
  const latest = React.useRef<{ onSelect?: BranchedMenuProps["onSelect"]; onToggle?: BranchedMenuProps["onToggle"] }>({});
  React.useEffect(() => {
    latest.current = { onSelect, onToggle };
  });

  // Controlled mode: an external active value (route) wins and opens
  // its section; otherwise the menu owns its state. Render-phase sync
  // (same pattern as the attendance sheet key) so no effect is needed.
  if (activeValue !== undefined && activeValue !== active) {
    setActive(activeValue);
    const section = items.findIndex((it) =>
      it.children?.some((kid) => kid.value === activeValue),
    );
    if (section >= 0) {
      setOpen((prev) => {
        if (prev.has(section)) return prev;
        const next = new Set(prev);
        next.add(section);
        return next;
      });
    }
  }

  const activeSection = items.findIndex((it) =>
    it.children?.some((kid) => kid.value === active),
  );
  const markerShown = activeSection >= 0 && open.has(activeSection);

  React.useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on && el) m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight]);

  const select = (value: string, item: BranchedMenuChild | BranchedMenuItem) => {
    setActive(value);
    latest.current.onSelect?.(value, item);
  };
  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      const isOpen = !next.has(i);
      if (isOpen) next.add(i);
      else next.delete(i);
      latest.current.onToggle?.(i, isOpen);
      return next;
    });
  };

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (k: number) => PAD + k * rowHeight + rowHeight / 2;
  const branch = (k: number) =>
    `M ${trunk} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) =>
    `M ${trunk} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - trunk - r);

  return (
    <nav
      ref={navRef}
      className={className ? `${styles.menu} ${className}` : styles.menu}
      style={
        {
          "--bm-w": `${width}px`,
          "--bm-ink": color,
          "--bm-accent": accentColor,
          "--bm-line": lineColor,
          "--bm-font": `${fontSize}px`,
          "--bm-row": `${rowHeight}px`,
          "--bm-indent": `${indent}px`,
          "--bm-line-w": lineWidth,
          "--bm-draw": `${drawDuration}ms`,
          "--bm-fold": `${foldDuration}ms`,
        } as React.CSSProperties
      }
    >
      <span ref={markerRef} className={styles.marker} aria-hidden="true" />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafValue = item.value ?? item.label;
        const leafActive = !kids && leafValue === active;
        // Parent branch is active when any of its children is — so the
        // group label follows the active link color too.
        const sectionActive = kids ? kids.some((kid) => kid.value === active) : leafActive;
        const bodyH = kids ? PAD * 2 + kids.length * rowHeight : 0;
        return (
          <div
            key={item.value ?? item.label}
            className={styles.section}
            data-open={isOpen ? "" : undefined}
          >
            {item.href && !kids ? (
              <Link
                ref={(el) => {
                  heads.current[i] = el;
                }}
                href={item.href}
                className={styles.head}
                aria-current={sectionActive ? "true" : undefined}
                data-active={sectionActive ? "" : undefined}
                onClick={() => select(leafValue, item)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                ref={(el) => {
                  heads.current[i] = el;
                }}
                type="button"
                className={styles.head}
                aria-expanded={kids ? isOpen : undefined}
                aria-current={sectionActive ? "true" : undefined}
                data-active={sectionActive ? "" : undefined}
                onClick={() => (kids ? toggle(i) : select(leafValue, item))}
              >
                {item.label}
              </button>
            )}
            {kids ? (
              <div className={styles.body}>
                <div className={styles.fold}>
                  <div className={styles.tree} style={{ height: bodyH }}>
                    <svg
                      className={styles.lines}
                      width={indent}
                      height={bodyH}
                      aria-hidden="true"
                    >
                      <path
                        className={styles.base}
                        d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`}
                      />
                      {kids.map((kid, k) => (
                        <path key={kid.value} className={styles.base} d={branch(k)} />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={kid.value}
                          className={styles.reach}
                          d={reach(k)}
                          style={{
                            strokeDasharray: length(k),
                            strokeDashoffset: kid.value === active ? 0 : length(k),
                          }}
                        />
                      ))}
                    </svg>
                    {kids.map((kid) => {
                      const kidActive = kid.value === active;
                      const kidInner = (
                        <>
                          {kid.icon ? (
                            <span className={styles.icon} aria-hidden="true">
                              {kid.icon}
                            </span>
                          ) : null}
                          <span className={styles.label}>{kid.label}</span>
                        </>
                      );
                      return kid.href ? (
                        <Link
                          key={kid.value}
                          href={kid.href}
                          className={styles.item}
                          aria-current={kidActive ? "true" : undefined}
                          data-active={kidActive ? "" : undefined}
                          tabIndex={isOpen ? undefined : -1}
                          onClick={() => select(kid.value, kid)}
                        >
                          {kidInner}
                        </Link>
                      ) : (
                        <button
                          key={kid.value}
                          type="button"
                          className={styles.item}
                          aria-current={kidActive ? "true" : undefined}
                          data-active={kidActive ? "" : undefined}
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => select(kid.value, kid)}
                        >
                          {kidInner}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
