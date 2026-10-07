"use client";

import { useCallback, useState, type CSSProperties } from "react";
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
  // Reset + overflow measure without effects: the reset syncs during
  // render, and the overflow check runs in the paragraph's callback ref
  // (DOM is available there, no effect needed).
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setExpanded(false);
  }
  // `text` re-fires the ref (React reattaches on identity change), so
  // content changes re-measure even though the body never reads it.
  /* eslint-disable react-hooks/exhaustive-deps -- ref identity drives re-measurement */
  const measureRef = useCallback(
    (el: HTMLParagraphElement | null) => {
      if (!el || expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    },
    [expanded, text]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className={className}>
      <p
        ref={measureRef}
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
