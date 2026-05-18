import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_THEME, isTocTheme, THEME_STORAGE_KEY, type TocTheme } from './themeTypes';

type ThemeContextValue = {
  theme: TocTheme;
  globalTheme: TocTheme;
  previewTheme: TocTheme | null;
  loading: boolean;
  setPreviewTheme: (theme: TocTheme) => void;
  clearPreviewTheme: () => void;
  setGlobalThemeLocally: (theme: TocTheme) => void;
  refreshGlobalTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: TocTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = 'dark';
}

function readPreviewTheme(): TocTheme | null {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTocTheme(raw) ? raw : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [globalTheme, setGlobalTheme] = useState<TocTheme>(DEFAULT_THEME);
  const [previewTheme, setPreviewThemeState] = useState<TocTheme | null>(() => readPreviewTheme());
  const [loading, setLoading] = useState(true);

  const theme = previewTheme ?? globalTheme;

  const refreshGlobalTheme = useCallback(async () => {
    const { data, error } = await supabase
      .from('league_settings')
      .select('theme_name')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[TOC theme] Failed to load league theme', error);
      setGlobalTheme(DEFAULT_THEME);
      return;
    }

    setGlobalTheme(isTocTheme(data?.theme_name) ? data.theme_name : DEFAULT_THEME);
  }, []);

  useEffect(() => {
    let mounted = true;

    refreshGlobalTheme()
      .catch((error) => {
        console.error('[TOC theme] Unexpected theme load failure', error);
        setGlobalTheme(DEFAULT_THEME);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshGlobalTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreviewTheme = useCallback((nextTheme: TocTheme) => {
    setPreviewThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const clearPreviewTheme = useCallback(() => {
    setPreviewThemeState(null);
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    applyTheme(globalTheme);
  }, [globalTheme]);

  const setGlobalThemeLocally = useCallback((nextTheme: TocTheme) => {
    setGlobalTheme(nextTheme);
    if (!previewTheme) applyTheme(nextTheme);
  }, [previewTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    globalTheme,
    previewTheme,
    loading,
    setPreviewTheme,
    clearPreviewTheme,
    setGlobalThemeLocally,
    refreshGlobalTheme,
  }), [theme, globalTheme, previewTheme, loading, setPreviewTheme, clearPreviewTheme, setGlobalThemeLocally, refreshGlobalTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
