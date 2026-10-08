"use client";

import { useSyncExternalStore } from "react";

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

  }
}

function subscribeAdviserCache(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function useCachedAdviser(teacherId: string | null | undefined): boolean | null {
  return useSyncExternalStore(
    subscribeAdviserCache,
    () => readCachedAdviser(teacherId),
    () => null,
  );
}

export function useCachedMasterTeacher(teacherId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeMasterTeacherCache,
    () => readCachedMasterTeacher(teacherId),
    () => false,
  );
}
