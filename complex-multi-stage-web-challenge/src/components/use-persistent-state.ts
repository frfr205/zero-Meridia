"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`nm-work:${key}`);
      if (saved !== null) setValue(JSON.parse(saved) as T);
    } catch {
      // A damaged local draft must never block access to the case.
    } finally {
      setLoaded(true);
    }
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(`nm-work:${key}`, JSON.stringify(value));
    } catch {
      // Server-side solved progress remains available when storage is full.
    }
  }, [key, loaded, value]);

  return [value, setValue];
}

export function clearPersistentDrafts() {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("nm-work:"))
    .forEach((key) => window.localStorage.removeItem(key));
}
