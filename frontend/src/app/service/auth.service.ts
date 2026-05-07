import { inject, Injectable } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth0 = inject(Auth0Service);

  loggedIn$: Observable<boolean> = this.auth0.isAuthenticated$;

  login(): void {
    this.auth0.loginWithRedirect({
      appState: { target: '/home' },
      authorizationParams: {
        audience: 'https://teacher-helper-api',
        scope: 'openid profile email',
      },
    });
  }

  register(): void {
    this.auth0.loginWithRedirect({
      appState: { target: '/home' },
      authorizationParams: {
        audience: 'https://teacher-helper-api',
        scope: 'openid profile email',
        screen_hint: 'signup',
      },
    });
  }

  logout(): void {
    localStorage.removeItem('teacher_authToken');
    localStorage.removeItem('teacher_userId');

    this.auth0.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  getAccessToken(): Observable<string> {
    return this.auth0.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://teacher-helper-api',
        scope: 'openid profile email',
      },
    });
  }

  setLogin(_token: string, _userId: string): void {
    // no-op after Auth0 migration
  }
}
