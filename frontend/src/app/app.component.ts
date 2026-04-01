import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { HttpService } from './service/http.service';
import { interval, filter, switchMap } from 'rxjs';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FooterComponent } from './components/footer/footer.component';
import { AuthService } from './service/auth.service';
import { ThemeService } from './service/theme.service';
import { LanguageService } from './service/language.service';

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
export class AppComponent implements OnInit {
  service = inject(HttpService);

  private router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

  isLoggedIn = false;
  isLoading = true;
  currentUrl = '/';

  constructor(private authService: AuthService) {
    this.authService.loggedIn$.subscribe(status => {
      this.isLoggedIn = status;
    });

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentUrl = event.urlAfterRedirects || event.url || '/';
      });

    this.currentUrl = this.router.url || '/';

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
        switchMap(() => this.service.getSchools())
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

  ngOnInit(): void {
    this.themeService.init();
    this.languageService.init();
    this.applyUserSettings();
  }

  private applyUserSettings(): void {
    const token = localStorage.getItem('teacher_authToken');
    if (!token) {
      return;
    }

    this.service.getUser().subscribe({
      next: user => {
        this.themeService.applyUserPreference(user.settings?.darkMode ?? null);
        this.languageService.applyUserPreference(user.settings?.language ?? null);
      },
      error: () => {
        // System/local fallback bleibt aktiv
      }
    });
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
