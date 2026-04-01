import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'de' | 'en';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly translate = inject(TranslateService);

  private readonly STORAGE_KEY = 'teacher_settings_language';
  private readonly supportedLanguages: AppLanguage[] = ['de', 'en'];
  private readonly defaultLanguage: AppLanguage = 'de';

  init(): void {
    this.translate.addLangs(this.supportedLanguages);
    this.translate.setDefaultLang(this.defaultLanguage);

    const lang = this.getStoredLanguage() ?? this.getSystemLanguage();
    this.applyLanguage(lang, false);
  }

  applyUserPreference(language: string | null | undefined): void {
    if (this.isSupported(language)) {
      this.applyLanguage(language, true);
      return;
    }

    localStorage.removeItem(this.STORAGE_KEY);
    this.applyLanguage(this.getSystemLanguage(), false);
  }

  getStoredLanguage(): AppLanguage | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return this.isSupported(stored) ? stored : null;
  }

  getSystemLanguage(): AppLanguage {
    const browserLang = this.translate.getBrowserLang() ?? navigator.language ?? 'de';

    if (browserLang.toLowerCase().startsWith('en')) {
      return 'en';
    }

    return 'de';
  }

  resolveLanguage(language: string | null | undefined): AppLanguage {
    if (this.isSupported(language)) {
      return language;
    }

    return this.getStoredLanguage() ?? this.getSystemLanguage();
  }

  private applyLanguage(language: AppLanguage, persist: boolean): void {
    this.translate.use(language);
    document.documentElement.lang = language;

    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, language);
    }
  }

  private isSupported(lang: string | null | undefined): lang is AppLanguage {
    return !!lang && this.supportedLanguages.includes(lang as AppLanguage);
  }
}
