"use client";

import { useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function subscribe(key: string, onChange: () => void) {
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set();
    listeners.set(key, bucket);
  }
  bucket.add(onChange);
  return () => {
    bucket.delete(onChange);
  };
}

function emit(key: string) {
  listeners.get(key)?.forEach((onChange) => onChange());
}

export function writeLocalString(key: string, value: string) {
  window.localStorage.setItem(key, value);
  emit(key);
}

export function useLocalString(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => subscribe(key, onChange),
    () => readLocalString(key),
    () => null
  );
}

function readLocalString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
