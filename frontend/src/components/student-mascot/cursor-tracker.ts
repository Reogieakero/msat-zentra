"use client";

/**
 * Shared cursor tracker for page-mascot-style aiming.
 *
 * One window-level `pointermove` listener no matter how many mascots are
 * mounted: moves are coalesced through a single rAF tick that fans out to
 * every subscribed aimer. Scroll (captured, so nested kanban scrollers
 * count) re-aims too, mirroring the page-mascot library.
 */

type AimListener = () => void;

let pointer: { x: number; y: number } | null = null;
const listeners = new Set<AimListener>();
let raf = 0;
let installed = false;

function notify() {
  raf = 0;
  listeners.forEach((listener) => {
    listener();
  });
}

function schedule() {
  if (raf !== 0) return;
  raf = window.requestAnimationFrame(notify);
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener(
    "pointermove",
    (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    },
    { passive: true },
  );
  window.addEventListener("scroll", schedule, { passive: true, capture: true });
}

export function getCursor(): { x: number; y: number } | null {
  return pointer;
}

/** Subscribe to cursor moves (coalesced per animation frame). */
export function subscribeAim(listener: AimListener): () => void {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
