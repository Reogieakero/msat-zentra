"use client";

import * as React from "react";
import { useReveal } from "@/lib/useReveal";

type RevealProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "header" | "li" | "article" | "ul";
  /** Stagger direct children by this many ms each. */
  stagger?: number;
};

export function Reveal({
  as = "div",
  stagger,
  className,
  children,
  style,
  ...rest
}: RevealProps) {
  const ref = useReveal<HTMLElement>();
  const Tag = as as React.ElementType;

  const childStyle =
    stagger != null
      ? ({
          ["--reveal-stagger" as string]: `${stagger}ms`,
        } as React.CSSProperties)
      : undefined;

  return (
    <Tag
      ref={ref}
      className={`reveal ${className ?? ""}`}
      style={{ ...childStyle, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
