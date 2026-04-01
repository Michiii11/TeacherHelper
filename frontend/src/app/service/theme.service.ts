import {inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common'

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'teacher_settings_dark_mode';
  private readonly DARK_CLASS = 'dark-theme';

  private readonly document = inject(DOCUMENT);

  init(): void {
    const enabled = localStorage.getItem(this.STORAGE_KEY) === 'true';
    this.apply(enabled);
    const stored = this.getStoredPreference();
    const resolved = stored ?? this.getSystemPreference();
    this.applyDarkMode(resolved, false);
  }

  setDarkMode(enabled: boolean): void {
    localStorage.setItem(this.STORAGE_KEY, String(enabled));
    this.apply(enabled);
  }

  private apply(enabled: boolean): void {
    this.document.body.classList.toggle('dark-mode', enabled);
    this.document.documentElement.classList.toggle('dark-mode', enabled);
    this.document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
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
    document.body.classList.toggle(this.DARK_CLASS, darkMode);

    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, String(darkMode));
    }
  }
}
