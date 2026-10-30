"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./insight-callout.module.css";

/**
 * Amber insight callout pinned under a desk chart to explain what the numbers
 * mean. One shape everywhere: 3px amber rule, 10% amber tint, rounded right
 * edge, muted body copy — emphasise figures with `<strong>`.
 *
 * Layout (e.g. `mt-auto` to pin it to the board bottom) stays with the caller.
 */
export function InsightCallout({
  className,
  children,
  ...rest
}: React.ComponentProps<"p">) {
  return (
    <p className={cn(styles.callout, className)} {...rest}>
      {children}
    </p>
  );
}
