export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'luxestay_theme';

export interface ThemeDomState {
  mode: ThemeMode;
  dataThemeAttr: ThemeMode;
  bodyClassesToAdd: string[];
  bodyClassesToRemove: string[];
}

/**
 * Resolves the initial theme from persisted storage or OS media query preference.
 */
export function resolveInitialTheme(
  persistedValue: string | null | undefined,
  prefersDark = false
): ThemeMode {
  if (persistedValue === 'dark' || persistedValue === 'light') {
    return persistedValue;
  }
  return prefersDark ? 'dark' : 'light';
}

/**
 * Toggles between 'light' and 'dark' theme modes.
 */
export function computeNextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * Computes the deterministic DOM class and attribute mutations for a given ThemeMode.
 */
export function buildThemeDomState(mode: ThemeMode): ThemeDomState {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      dataThemeAttr: 'dark',
      bodyClassesToAdd: ['dark-theme', 'dark'],
      bodyClassesToRemove: ['light-theme']
    };
  }
  return {
    mode: 'light',
    dataThemeAttr: 'light',
    bodyClassesToAdd: ['light-theme'],
    bodyClassesToRemove: ['dark-theme', 'dark']
  };
}
