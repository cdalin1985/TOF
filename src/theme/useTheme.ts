import { createContext, useContext } from 'react';
import type { TocTheme } from './themeTypes';

export type ThemeContextValue = {
  theme: TocTheme;
  globalTheme: TocTheme;
  previewTheme: TocTheme | null;
  loading: boolean;
  setPreviewTheme: (theme: TocTheme) => void;
  clearPreviewTheme: () => void;
  setGlobalThemeLocally: (theme: TocTheme) => void;
  refreshGlobalTheme: () => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
