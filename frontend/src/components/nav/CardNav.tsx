"use client";

import * as React from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ArrowUpRight } from "lucide-react";
import styles from "./CardNav.module.css";

export interface CardNavLink {
  label: string;
  ariaLabel?: string;
  href?: string;
}

export interface CardNavItem {
  label: string;
  bgColor: string;
  textColor: string;
  links: CardNavLink[];
}

interface CardNavProps {
  logo?: string;
  logoAlt?: string;
  brand?: string;
  items?: CardNavItem[];
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
}

/* CardNav (reactbits) ported to TypeScript + CSS modules. Links render as
   Next.js Links and collapse the menu on navigate; icons come from lucide;
   type is set to the app font. Colors accept CSS variables. */
export default function CardNav({
  logo,
  logoAlt = "Logo",
  brand,
  items = [],
  ctaLabel,
  ctaHref,
  className = "",
  ease = "power3.out",
  baseColor = "var(--card)",
  menuColor = "var(--foreground)",
  buttonBgColor = "var(--primary)",
  buttonTextColor = "var(--primary-foreground)",
}: CardNavProps) {
  const [isHamburgerOpen, setIsHamburgerOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const navRef = React.useRef<HTMLElement | null>(null);
  const cardsRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = React.useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = React.useCallback(() => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const contentEl = navEl.querySelector(`.${styles.content}`);
      if (contentEl instanceof HTMLElement) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";

        void contentEl.offsetHeight;

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 260;
  }, []);

  const createTimeline = React.useCallback(() => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease,
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, "-=0.1");

    return tl;
  }, [calculateHeight, ease]);

  React.useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [createTimeline]);

  React.useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded, calculateHeight, createTimeline]);

  const closeMenu = React.useCallback(() => {
    const tl = tlRef.current;
    setIsHamburgerOpen(false);
    if (!tl) {
      setIsExpanded(false);
      return;
    }
    tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
    tl.reverse();
  }, []);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      closeMenu();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className={className ? `${styles.container} ${className}` : styles.container}>
      <nav
        ref={navRef}
        className={`${styles.nav} ${isExpanded ? styles.open : ""}`}
        style={{ backgroundColor: baseColor }}
      >
        <div className={styles.top}>
          <button
            type="button"
            className={`${styles.hamburger} ${isHamburgerOpen ? styles.open : ""}`}
            onClick={toggleMenu}
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            aria-expanded={isExpanded}
            style={{ color: menuColor }}
          >
            <div className={styles.hamburgerLine} />
            <div className={styles.hamburgerLine} />
          </button>

          <div className={styles.logoWrap}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={logoAlt} className={styles.logo} />
            ) : (
              <span className={styles.brand}>{brand ?? logoAlt}</span>
            )}
          </div>

          {ctaLabel ? (
            ctaHref ? (
              <Link
                href={ctaHref}
                className={styles.cta}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {ctaLabel}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.cta}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {ctaLabel}
              </button>
            )
          ) : null}
        </div>

        <div className={styles.content} aria-hidden={!isExpanded}>
          {(items || []).slice(0, 4).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className={styles.card}
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className={styles.cardLabel}>{item.label}</div>
              <div className={styles.cardLinks}>
                {item.links?.map((lnk, i) => (
                  <Link
                    key={`${lnk.label}-${i}`}
                    className={styles.cardLink}
                    href={lnk.href ?? "#"}
                    aria-label={lnk.ariaLabel}
                    tabIndex={isExpanded ? undefined : -1}
                    onClick={closeMenu}
                  >
                    <ArrowUpRight className={styles.cardLinkIcon} aria-hidden="true" />
                    {lnk.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
