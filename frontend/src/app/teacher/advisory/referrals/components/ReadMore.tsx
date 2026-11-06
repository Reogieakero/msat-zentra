"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./ReadMore.module.css";

interface ReadMoreProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ReadMore({ text, maxLines = 3, className = "" }: ReadMoreProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setExpanded(false);
  }
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
