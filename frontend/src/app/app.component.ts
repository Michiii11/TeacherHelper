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
  private readonly destroy$ = new Subject<void>();
  protected readonly Config = Config

  themeService = inject(ThemeService);
  languageService = inject(LanguageService);

  router = inject(Router);
  service = inject(HttpService);
  authService = inject(AuthService);

  isLoggedIn = false;
  isLoading = true;
  currentUrl = '/';

  constructor() {
    this.themeService.init();
    this.languageService.init();

    this.authService.loggedIn$.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(status => {
        this.isLoggedIn = status;

        if (status) {
          this.loadAndApplyUserSettings();
        } else {
          this.applyGuestDefaults();
        }
      });

    this.router.events.pipe(filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects || event.url || '/';
      });

    this.currentUrl = this.router.url || '/';
  }

  ngOnInit(): void {
    this.waitForBackend();

    this.service.validateToken().subscribe({
      next: data => {
        this.isLoggedIn = data;
        this.loadAndApplyUserSettings();
      }, error: () => {
        this.isLoggedIn = false;
        this.applyGuestDefaults();
      }
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
        },
        error: () => {
          setTimeout(tryConnect, 3000);
        }
      });
    };

    tryConnect();
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
