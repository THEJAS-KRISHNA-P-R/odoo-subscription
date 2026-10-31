'use client';

/**
 * @file lib/theme.tsx
 * @description Theme management provider supporting 'light', 'dark', and 'system' modes.
 * Synchronizes the `.dark` class on `document.documentElement` and listens to OS-level
 * `prefers-color-scheme: dark` media query changes in real time when set to 'system'.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePreference = ThemeMode;
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  setMode: (next: ThemeMode) => void;
}

const STORAGE_KEY = 'brightloop:theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  mode: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  setMode: () => {},
});

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedThemeToDom(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen to OS-level prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const nextSys: ResolvedTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(nextSys);
    };
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = mode === 'system' ? systemTheme : mode;

  // Apply .dark class and color-scheme to <html>
  useEffect(() => {
    applyResolvedThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      const nextResolved: ResolvedTheme = next === 'system' ? getSystemTheme() : next;
      applyResolvedThemeToDom(nextResolved);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      theme: mode,
      mode,
      resolvedTheme,
      setTheme: setMode,
      setMode,
    }),
    [mode, resolvedTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook returning current theme preference ('light' | 'dark' | 'system'),
 * the active resolved theme ('light' | 'dark'), and a setter function.
 */
export function useTheme() {
  return useContext(ThemeContext);
}
