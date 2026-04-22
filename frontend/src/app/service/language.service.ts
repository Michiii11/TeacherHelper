import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'de' | 'en';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  private readonly STORAGE_KEY = 'teacher_settings_language';
  private readonly supportedLanguages: AppLanguage[] = ['de', 'en'];
  private readonly defaultLanguage: AppLanguage = 'de';

  init(): void {
    this.translate.addLangs(this.supportedLanguages);
    this.translate.setDefaultLang(this.defaultLanguage);

    const lang = this.resolveLanguage(this.getStoredLanguage() ?? this.getSystemLanguage());
    this.applyLanguage(lang, false);
  }

  applyUserPreference(language: string | null | undefined): void {
    const resolved = this.resolveLanguage(language);

    if (this.isSupported(language)) {
      this.applyLanguage(resolved, true);
      return;
    }

    localStorage.removeItem(this.STORAGE_KEY);
    this.applyLanguage(resolved, false);
  }

  setLanguage(language: AppLanguage | string | null | undefined): void {
    const resolved = this.resolveLanguage(language);
    this.applyLanguage(resolved, true);
  }

  getStoredLanguage(): AppLanguage | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return this.isSupported(stored) ? stored : null;
  }

  getSystemLanguage(): AppLanguage {
    const browserLang = this.translate.getBrowserLang() ?? navigator.language ?? this.defaultLanguage;

    if (String(browserLang).toLowerCase().startsWith('en')) {
      return 'en';
    }

    return 'de';
  }

  resolveLanguage(language: string | null | undefined): AppLanguage {
    if (this.isSupported(language)) {
      return language;
    }

    return this.getStoredLanguage() ?? this.getSystemLanguage() ?? this.defaultLanguage;
  }

  private applyLanguage(language: AppLanguage | string | null | undefined, persist: boolean): void {
    const resolved = this.resolveLanguage(language);

    this.translate.use(resolved);
    this.document.documentElement.lang = resolved;

    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, resolved);
    }
  }

  private isSupported(lang: string | null | undefined): lang is AppLanguage {
    return !!lang && this.supportedLanguages.includes(lang as AppLanguage);
  }
}
