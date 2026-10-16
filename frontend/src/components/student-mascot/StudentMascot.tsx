"use client";

import * as React from "react";
import { MASCOT_BLINK_ANCHORS, MASCOT_DIRECTION_ANCHORS } from "./mascot-anchors";
import { useMascotAim } from "./use-mascot-aim";

const CHARACTERS = [
  "afro",
  "astronaut",
  "bald",
  "ballerina",
  "bear",
  "beard",
  "builder",
  "bunny",
  "cap",
  "cat",
  "chef",
  "clockwork",
  "crt",
  "cube",
  "deer",
  "dino",
  "droid",
  "drone",
  "fox",
  "frog",
  "gearbot",
  "glasses",
  "grandpa",
  "granny",
  "hamster",
  "hedgehog",
  "hijabi",
  "kamran",
  "knight",
  "koala",
  "lantern",
  "mouse",
  "nurse",
  "otter",
  "owl",
  "panda",
  "penguin",
  "pirate",
  "postbot",
  "pug",
  "raccoon",
  "radio",
  "redpanda",
  "robot",
  "rocket",
  "scientist",
  "scout",
  "sheep",
  "sikh",
  "skater",
  "sloth",
  "tiger",
  "toaster",
  "tv",
  "wizard",
] as const;

function pickCharacter(seed: string): (typeof CHARACTERS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CHARACTERS[hash % CHARACTERS.length]!;
}

/** Roster for deterministic unique assignment (no two students share one). */
export const MASCOT_CHARACTERS = CHARACTERS;

// 3x3 sheet: each cell is a clean 0/50/100% background step on both axes.
function cell(index: number): React.CSSProperties {
  return {
    backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
  };
}

/** Profile mascot painted from the page-mascot sprite sheets (same
    3x3 direction/expression layout as nilbuild/page-mascot). The head
    watches the cursor like the reference landing page; each sprite
    layer is counter-shifted from measured per-cell anchors so the body
    stays planted and only the head pose changes. Static without a fine
    pointer and under prefers-reduced-motion.
    Pass `character` to pin a stored DB mascot; otherwise it is derived
    from `${name}:${seed}` (same derivation the backend persists). */
export function StudentMascot({
  name,
  seed = "",
  size = 40,
  character,
}: {
  name: string;
  seed?: string;
  size?: number;
  character?: string;
}) {
  const fallback = pickCharacter(`${name}:${seed}`);
  const characterIsKnown =
    typeof character === "string" &&
    (CHARACTERS as readonly string[]).includes(character);
  const characterName = characterIsKnown ? character! : fallback;
  const frameRef = React.useRef<HTMLSpanElement>(null);
  const frame = useMascotAim(frameRef);
  const [blink, setBlink] = React.useState(false);
  const timers = React.useRef<number[]>([]);

  // Body-planting compensation (px at display size): our sheets shift the
  // whole figure between cells (up to ~19% of a cell), so each layer is
  // counter-shifted by its measured centroid offset. Unknown characters
  // fall back to unshifted frames.
  const dirAnchor = MASCOT_DIRECTION_ANCHORS[characterName];
  const blinkAnchor = MASCOT_BLINK_ANCHORS[characterName];
  const dirShift =
    dirAnchor != null && frame >= 0 && frame < dirAnchor.dx.length
      ? {
          x: (dirAnchor.dx[frame] ?? 0) * size,
          y: (dirAnchor.dy[frame] ?? 0) * size,
        }
      : { x: 0, y: 0 };
  const blinkShift = blinkAnchor
    ? { x: blinkAnchor.dx * size, y: blinkAnchor.dy * size }
    : { x: 0, y: 0 };

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    const later = (ms: number, fn: () => void) => {
      timers.current.push(
        window.setTimeout(() => {
          if (alive) fn();
        }, ms),
      );
    };
    const blinkLoop = () => {
      setBlink(true);
      later(220, () => {
        setBlink(false);
        later(2600 + Math.random() * 5200, blinkLoop);
      });
    };
    later(1500 + Math.random() * 3500, blinkLoop);
    return () => {
      alive = false;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, []);

  const base = `/mascots/${characterName}`;
  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundSize: "300% 300%",
    backgroundRepeat: "no-repeat",
  };
  return (
    <span
      ref={frameRef}
      role="img"
      aria-label={`${name}'s profile mascot`}
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        style={{
          ...layer,
          backgroundImage: `url(${base}-directions.png)`,
          ...cell(frame),
          transform: `translate(${dirShift.x.toFixed(2)}px, ${dirShift.y.toFixed(2)}px)`,
          opacity: blink ? 0 : 1,
        }}
      />
      <span
        aria-hidden
        style={{
          ...layer,
          backgroundImage: `url(${base}-reactions.png)`,
          ...cell(0),
          transform: `translate(${blinkShift.x.toFixed(2)}px, ${blinkShift.y.toFixed(2)}px)`,
          opacity: blink ? 1 : 0,
        }}
      />
    </span>
  );
}
