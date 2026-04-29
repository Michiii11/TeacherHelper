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

  private readonly storageKey = 'teacher_settings_language';
  private readonly supportedLanguages: readonly AppLanguage[] = ['de', 'en'];
  private readonly defaultLanguage: AppLanguage = 'de';

  init(): void {
    this.translate.addLangs([...this.supportedLanguages]);
    this.applyLanguage(this.resolveLanguage(), false);
  }

  setLanguage(language: AppLanguage | string | null | undefined): void {
    this.applyLanguage(this.resolveLanguage(language), true);
  }

  applyUserPreference(language: string | null | undefined): void {
    if (!this.isSupported(language)) {
      localStorage.removeItem(this.storageKey);
      this.applyLanguage(this.resolveLanguage(), false);
      return;
    }

    this.applyLanguage(language, true);
  }

  getStoredLanguage(): AppLanguage | null {
    const stored = localStorage.getItem(this.storageKey);
    return this.isSupported(stored) ? stored : null;
  }

  resolveLanguage(language?: string | null): AppLanguage {
    if (this.isSupported(language)) {
      return language;
    }

    return this.getStoredLanguage() ?? this.getSystemLanguage();
  }

  private getSystemLanguage(): AppLanguage {
    const browserLang = this.translate.getBrowserLang() ?? navigator.language;
    return browserLang?.toLowerCase().startsWith('en') ? 'en' : this.defaultLanguage;
  }

  private applyLanguage(language: AppLanguage, persist: boolean): void {
    this.translate.use(language);
    this.document.documentElement.lang = language;

    if (persist) {
      localStorage.setItem(this.storageKey, language);
    }
  }

  private isSupported(language: string | null | undefined): language is AppLanguage {
    return !!language && this.supportedLanguages.includes(language as AppLanguage);
  }
}
