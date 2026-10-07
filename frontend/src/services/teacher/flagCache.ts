"use client";

import { useSyncExternalStore } from "react";

// Master-teacher + adviser flags mirrored per teacher in localStorage so the
// sidebar branch and schedule gates paint correctly on the very first frame
// after a hard refresh — before the overview query resolves. Keys are
// teacher-scoped and logout wipes every `zentra.*` key, so a flag can never
// leak across accounts. The live overview always overwrites these on fetch.
function masterTeacherCacheKey(teacherId: string | null | undefined): string | null {
  return teacherId ? `zentra.masterTeacher.${teacherId}` : null;
}

export function readCachedMasterTeacher(teacherId: string | null | undefined): boolean {
  if (typeof window === "undefined") return false;
  const key = masterTeacherCacheKey(teacherId);
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeCachedMasterTeacher(
  teacherId: string | null | undefined,
  value: boolean,
): void {
  const key = masterTeacherCacheKey(teacherId);
  if (!key || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode / blocked storage — the live overview stays authoritative.
  }
}

function subscribeMasterTeacherCache(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function adviserCacheKey(teacherId: string | null | undefined): string | null {
  return teacherId ? `zentra.adviser.${teacherId}` : null;
}

export function readCachedAdviser(teacherId: string | null | undefined): boolean | null {
  if (typeof window === "undefined") return null;
  const key = adviserCacheKey(teacherId);
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return null;
    return v === "1";
  } catch {
    return null;
  }
}

export function writeCachedAdviser(
  teacherId: string | null | undefined,
  value: boolean,
): void {
  const key = adviserCacheKey(teacherId);
  if (!key || typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.setItem(key, "0");
  } catch {
    // Private mode / blocked storage — the live overview stays authoritative.
  }
}

function subscribeAdviserCache(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Hydration-safe first-frame flag (null = unknown yet). Renders the server
// snapshot (null) through hydration, then flips to the cached value on the
// client. Callers treat null as "still loading — show full nav".
export function useCachedAdviser(teacherId: string | null | undefined): boolean | null {
  return useSyncExternalStore(
    subscribeAdviserCache,
    () => readCachedAdviser(teacherId),
    () => null,
  );
}

// Hydration-safe first-frame flag. A `useState` initializer reading
// localStorage renders different tabs on the server (no window) vs the
// client (cached "1") — a hydration mismatch. `useSyncExternalStore` renders
// the server snapshot (false) through hydration, then flips to the cached
// value on the client with a normal re-render. Same-tab toggles flow through
// the overview query cache; the `storage` listener keeps other open tabs in
// sync for free.
export function useCachedMasterTeacher(teacherId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeMasterTeacherCache,
    () => readCachedMasterTeacher(teacherId),
    () => false,
  );
}
