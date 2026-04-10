import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { HttpService } from './service/http.service';
import { interval, filter, switchMap, take, Subject, distinctUntilChanged, takeUntil } from 'rxjs';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FooterComponent } from './components/footer/footer.component';
import { AuthService } from './service/auth.service';
import { ThemeService } from './service/theme.service';
import { LanguageService } from './service/language.service';
import { Config } from './config';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    MatProgressSpinner,
    FooterComponent
  ],
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  service = inject(HttpService);

  private router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly destroy$ = new Subject<void>();

  isLoggedIn = false;
  isLoading = true;
  currentUrl = '/';

  constructor(private authService: AuthService) {
    this.authService.loggedIn$
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(status => {
        this.isLoggedIn = status;

        if (status) {
          this.loadAndApplyUserSettings();
        } else {
          this.themeService.init();
          this.languageService.init();
        }
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects || event.url || '/';
      });

    this.currentUrl = this.router.url || '/';
  }

  ngOnInit(): void {
    // zuerst immer System / lokale Defaults
    this.themeService.init();
    this.languageService.init();

    // falls beim App-Start schon eingeloggt
    const token = localStorage.getItem('teacher_authToken');
    if (token) {
      this.loadAndApplyUserSettings();
    }

    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAndApplyUserSettings(): void {
    this.service.getUser()
      .pipe(take(1))
      .subscribe({
        next: user => {
          const resolvedDarkMode = this.themeService.resolveDarkMode(user.settings?.darkMode ?? null);
          const resolvedLanguage = this.languageService.resolveLanguage(user.settings?.language ?? null);

          this.themeService.setDarkMode(resolvedDarkMode);
          this.languageService.applyUserPreference(resolvedLanguage);
        },
        error: () => {
          // Fallback bleibt auf System/default
        }
      });
  }

  private loadInitialData(): void {
    this.service.getSchools().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    if (this.isLoading) {
      interval(2000).pipe(
        switchMap(() => this.service.getSchools()),
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
    }
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

  protected readonly Config = Config;
}
