import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly storageKey = 'teacher_settings_dark_mode';
  private readonly darkClass = 'dark-mode';

  init(): void {
    this.applyDarkMode(this.resolveDarkMode(), false);
  }

  setDarkMode(enabled: boolean): void {
    this.applyDarkMode(enabled, true);
  }

  getStoredPreference(): boolean | null {
    const value = localStorage.getItem(this.storageKey);

    if (value === 'true') return true;
    if (value === 'false') return false;

    return null;
  }

  resolveDarkMode(darkMode?: boolean | null): boolean {
    return typeof darkMode === 'boolean'
      ? darkMode
      : this.getStoredPreference() ?? this.getSystemPreference();
  }

  private getSystemPreference(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private applyDarkMode(enabled: boolean, persist: boolean): void {
    const root = this.document.documentElement;

    root.classList.toggle(this.darkClass, enabled);
    this.document.body.classList.toggle(this.darkClass, enabled);
    root.style.colorScheme = enabled ? 'dark' : 'light';

    if (persist) {
      localStorage.setItem(this.storageKey, String(enabled));
    }
  }
}
