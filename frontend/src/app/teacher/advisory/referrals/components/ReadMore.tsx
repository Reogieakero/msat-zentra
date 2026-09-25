"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./ReadMore.module.css";

interface ReadMoreProps {
  text: string;
  maxLines?: number;
  className?: string;
}

// Collapsible long text for non-techy readers: clamps to a few lines with
// a chevron Read more / Show less toggle. The toggle only appears when the
// text actually overflows.
export function ReadMore({ text, maxLines = 3, className = "" }: ReadMoreProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`${styles.text} ${expanded ? "" : styles.clamped}`}
        style={
          expanded
            ? undefined
            : ({ WebkitLineClamp: maxLines, lineClamp: maxLines } as CSSProperties)
        }
      >
        {text}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp aria-hidden />
            </>
          ) : (
            <>
              Read more
              <ChevronDown aria-hidden />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
