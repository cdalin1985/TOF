export const TOC_THEMES = ['classic', 'neon-billiards'] as const;

export type TocTheme = (typeof TOC_THEMES)[number];

export const DEFAULT_THEME: TocTheme = 'classic';
export const THEME_STORAGE_KEY = 'toc.theme.preview';

export function isTocTheme(value: unknown): value is TocTheme {
  return typeof value === 'string' && TOC_THEMES.includes(value as TocTheme);
}
