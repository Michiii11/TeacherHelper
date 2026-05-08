import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { HttpService } from './service/http.service';
import { filter, Subject, distinctUntilChanged, takeUntil } from 'rxjs';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FooterComponent } from './components/footer/footer.component';
import { AuthService } from './service/auth.service';
import { ThemeService } from './service/theme.service';
import { LanguageService } from './service/language.service';
import { Config } from './config';
import { TranslatePipe } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import {APP_CHANGELOG, ChangelogEntry} from '../../public/data/changelog.data'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    MatProgressSpinner,
    FooterComponent,
    TranslatePipe,
    MatIconModule
  ],
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly whatsNewStoragePrefix = 'teacher-helper.whats-new.seen.';

  protected readonly Config = Config;
  readonly changelog = APP_CHANGELOG;

  themeService = inject(ThemeService);
  languageService = inject(LanguageService);

  router = inject(Router);
  service = inject(HttpService);
  authService = inject(AuthService);

  isLoggedIn = false;
  isLoading = true;
  currentUrl = '/';
  showWhatsNewPanel = false;

  constructor() {
    this.themeService.init();
    this.languageService.init();

    this.authService.loggedIn$
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(status => {
        this.isLoggedIn = status;

        if (status) {
          this.loadAndApplyUserSettings();
        } else {
          this.applyGuestDefaults();
          this.showWhatsNewPanel = false;
        }

        this.updateWhatsNewVisibility();
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects || event.url || '/';
        this.updateWhatsNewVisibility();
      });

    this.currentUrl = this.router.url || '/';
  }

  ngOnInit(): void {
    this.waitForBackend();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismissWhatsNew(): void {
    this.markLatestChangelogAsSeen();
    this.showWhatsNewPanel = false;
  }

  openChangelog(): void {
    this.markLatestChangelogAsSeen();
    this.showWhatsNewPanel = false;

    void this.router.navigate(['/help'], {
      queryParams: { tab: 'changelog' }
    });
  }

  get latestChangelogEntry(): ChangelogEntry | null {
    return this.changelog.find(entry => entry.isLatest) ?? this.changelog[0] ?? null;
  }

  private applyGuestDefaults(): void {
    this.themeService.init();
    this.languageService.init();
  }

  private loadAndApplyUserSettings(): void {
    this.service.getUser().subscribe({
      next: user => {
        this.themeService.setDarkMode(this.themeService.resolveDarkMode(user.settings?.darkMode ?? null));
        this.languageService.applyUserPreference(this.languageService.resolveLanguage(user.settings?.language ?? null));
      },
      error: () => {
        this.applyGuestDefaults();
      }
    });
  }

  private waitForBackend(): void {
    this.isLoading = true;

    const tryConnect = () => {
      this.service.getServer().subscribe({
        next: () => {
          this.isLoading = false;
          this.updateWhatsNewVisibility();
        },
        error: () => {
          setTimeout(tryConnect, 3000);
        }
      });
    };

    tryConnect();
  }

  private updateWhatsNewVisibility(): void {
    const latest = this.latestChangelogEntry;

    if (!latest || !this.isLoggedIn || this.isLandingRoute || this.isLoading) {
      this.showWhatsNewPanel = false;
      return;
    }

    this.showWhatsNewPanel = !this.hasSeenLatestChangelog(latest.version);
  }

  private hasSeenLatestChangelog(version: string): boolean {
    try {
      return localStorage.getItem(this.getWhatsNewStorageKey(version)) === 'true';
    } catch {
      return false;
    }
  }

  private markLatestChangelogAsSeen(): void {
    const latest = this.latestChangelogEntry;
    if (!latest) {
      return;
    }

    try {
      localStorage.setItem(this.getWhatsNewStorageKey(latest.version), 'true');
    } catch {
      // If localStorage is unavailable, only hide it for the current session.
    }
  }

  private getWhatsNewStorageKey(version: string): string {
    return `${this.whatsNewStoragePrefix}${version}`;
  }

  get isLandingRoute(): boolean {
    return this.currentUrl === '/';
  }

  get showNavigation(): boolean {
    return this.isLoggedIn && !this.isLandingRoute;
  }

  get showFooter(): boolean {
    return this.isLoggedIn || this.isLandingRoute;
  }
}
