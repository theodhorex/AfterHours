"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Returns current prefers-reduced-motion boolean.
 * SSR safe: returns false when window or matchMedia is undefined.
 */
export function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

/**
 * Subscribes to prefers-reduced-motion changes.
 * Returns an unsubscribe cleanup function.
 * SSR safe: returns no-op cleanup when window or matchMedia is undefined.
 */
export function subscribeReducedMotion(
  cb: (reduced: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mql = window.matchMedia(QUERY);
  const handler = (event: MediaQueryListEvent | MediaQueryList | { matches: boolean }) => {
    cb(event.matches);
  };

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler as EventListener);
    return () => {
      mql.removeEventListener("change", handler as EventListener);
    };
  }

  // Fallback for legacy environments
  const legacyMql = mql as unknown as {
    addListener?: (fn: typeof handler) => void;
    removeListener?: (fn: typeof handler) => void;
  };
  if (typeof legacyMql.addListener === "function") {
    legacyMql.addListener(handler);
    return () => {
      legacyMql.removeListener?.(handler);
    };
  }

  return () => {};
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * React hook for prefers-reduced-motion.
 * Backed by useSyncExternalStore with false as server snapshot.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerSnapshot,
  );
}
