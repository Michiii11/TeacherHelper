import {ApplicationConfig, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideAnimations } from '@angular/platform-browser/animations';
import {provideAuth0} from '@auth0/auth0-angular';
import { auth0TokenInterceptor } from './interceptors/auth0-token.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([auth0TokenInterceptor])),
    provideAnimations(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'de',
      lang: 'de'
    }),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        subscriptSizing: 'dynamic'
      }
    },
    provideAuth0({
      domain: 'teacher-helper.eu.auth0.com',
      clientId: 'XK7QG99mue4wTIDYCaaTaYOyqY6cx3jR',
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://teacher-helper-api',
        scope: 'openid profile email',
      },
      cacheLocation: 'memory',
      useRefreshTokens: false,
    }),
  ]
};
