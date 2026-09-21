"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark";

export const THEME_STORAGE_KEY = "ascension.theme";

const listeners = new Set<() => void>();

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark";
}

function readStoredTheme(): ThemeChoice | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(): ThemeChoice {
  return readStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
}

function applyTheme(theme: ThemeChoice) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    // Follow the system only while the user has no explicit choice.
    if (readStoredTheme() === null) {
      applyTheme(resolveTheme());
      emit();
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(resolveTheme());
      emit();
    }
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns the resolved theme, or null on the server / before hydration. */
export function useTheme() {
  const theme = useSyncExternalStore<ThemeChoice | null>(subscribe, resolveTheme, () => null);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: still apply for this session.
    }
    applyTheme(next);
    emit();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolveTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
