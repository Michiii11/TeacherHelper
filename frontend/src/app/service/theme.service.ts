import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly STORAGE_KEY = 'teacher_settings_dark_mode';

  init(): void {
    const enabled = localStorage.getItem(this.STORAGE_KEY) === 'true';
    this.apply(enabled);
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
}
