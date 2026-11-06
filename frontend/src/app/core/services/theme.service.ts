import { Injectable, computed, effect, signal } from '@angular/core';
import {
  THEME_STORAGE_KEY,
  ThemeMode,
  buildThemeDomState,
  computeNextTheme,
  resolveInitialTheme
} from './theme.utils';

/**
 * Centralized Theme Service (Angular 22 Signals)
 * Manages Light/Dark mode state, synchronizes body class (`dark-theme` / `light-theme`)
 * and `data-theme` attribute on `document.body` and `document.documentElement`,
 * and persists user preference to `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>(this.loadInitialTheme());

  readonly theme = this.modeSignal.asReadonly();
  readonly isDark = computed(() => this.modeSignal() === 'dark');

  constructor() {
    this.applyThemeToDom(this.modeSignal());

    effect(() => {
      const currentMode = this.modeSignal();
      this.applyThemeToDom(currentMode);
      this.persistTheme(currentMode);
    });
  }

  toggleTheme(): void {
    this.modeSignal.update(current => computeNextTheme(current));
  }

  setTheme(mode: ThemeMode): void {
    this.modeSignal.set(mode);
  }

  private loadInitialTheme(): ThemeMode {
    if (typeof window === 'undefined') {
      return 'light';
    }
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      // Default to light luxury hospitality theme unless user explicitly chose dark
      return resolveInitialTheme(saved, false);
    } catch {
      return 'light';
    }
  }

  private persistTheme(mode: ThemeMode): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  private applyThemeToDom(mode: ThemeMode): void {
    if (typeof document === 'undefined' || !document.body) {
      return;
    }
    const domState = buildThemeDomState(mode);
    document.body.setAttribute('data-theme', domState.dataThemeAttr);
    document.documentElement.setAttribute('data-theme', domState.dataThemeAttr);

    for (const cls of domState.bodyClassesToRemove) {
      document.body.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    }
    for (const cls of domState.bodyClassesToAdd) {
      document.body.classList.add(cls);
      document.documentElement.classList.add(cls);
    }
  }
}
