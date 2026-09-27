import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { catchError, switchMap, throwError } from 'rxjs';

import { Config } from '../config';

function isAccountLockedError(error: HttpErrorResponse): boolean {
  if (error.status !== 403) {
    return false;
  }

  const body = error.error;

  if (typeof body === 'string') {
    return body.includes('ACCOUNT_LOCKED');
  }

  if (body && typeof body === 'object') {
    const values = [
      String(body.code ?? ''),
      String(body.message ?? ''),
      String(body.detail ?? ''),
      String(body.title ?? ''),
    ];

    return values.some(value => value.includes('ACCOUNT_LOCKED'));
  }

  return false;
}

export const auth0TokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth0 = inject(Auth0Service);
  const router = inject(Router);

  if (!req.url.startsWith(Config.API_URL)) {
    return next(req);
  }

  const publicAuthEndpoints = [
    '/user/server',
    '/user/register',
    '/user/login',
    '/user/validate',
    '/user/verify-email',
    '/user/verify-code',
    '/user/email/resend-verification',
    '/user/password/forgot',
    '/user/password/reset',
  ];

  if (publicAuthEndpoints.some(endpoint => req.url.includes(endpoint))) {
    return next(req);
  }

  return auth0.getAccessTokenSilently({
    authorizationParams: {
      audience: 'https://teacher-helper-api',
      scope: 'openid profile email',
    },
  }).pipe(
    switchMap(token => {
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });

      return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (isAccountLockedError(error) && router.url !== '/blocked') {
            void router.navigateByUrl('/blocked');
          }

          return throwError(() => error);
        }),
      );
    }),
  );
};
