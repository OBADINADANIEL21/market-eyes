import { useEffect, useState } from "react";

/**
 * useState that persists to localStorage.
 * - Reads the saved value once on first render (survives page reloads).
 * - Writes whenever the value changes.
 * - Stays in sync across browser tabs via the "storage" event.
 * All storage access is wrapped in try/catch so private mode or a full
 * quota never crashes the app.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Save on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable - keep working in memory */
    }
  }, [key, value]);

  // Pick up changes made in another tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue));
      } catch {
        /* ignore malformed data */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue];
}
