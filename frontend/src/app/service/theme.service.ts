import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'teacher_settings_dark_mode';
  private readonly DARK_CLASS = 'dark-mode';
  private readonly document = inject(DOCUMENT);

  init(): void {
    const resolved = this.getStoredPreference() ?? this.getSystemPreference();
    this.applyDarkMode(resolved, false);
  }

  setDarkMode(enabled: boolean): void {
    this.applyDarkMode(enabled, true);
  }

  applyUserPreference(darkMode: boolean | null | undefined): void {
    if (typeof darkMode === 'boolean') {
      this.applyDarkMode(darkMode, true);
      return;
    }

    localStorage.removeItem(this.STORAGE_KEY);
    this.applyDarkMode(this.getSystemPreference(), false);
  }

  getStoredPreference(): boolean | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);

    if (raw === 'true') return true;
    if (raw === 'false') return false;

    return null;
  }

  getSystemPreference(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  resolveDarkMode(darkMode: boolean | null | undefined): boolean {
    if (typeof darkMode === 'boolean') {
      return darkMode;
    }

    return this.getStoredPreference() ?? this.getSystemPreference();
  }

  private applyDarkMode(darkMode: boolean, persist: boolean): void {
    this.document.body.classList.toggle(this.DARK_CLASS, darkMode);
    this.document.documentElement.classList.toggle(this.DARK_CLASS, darkMode);
    this.document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';

    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, String(darkMode));
    }
  }
}
