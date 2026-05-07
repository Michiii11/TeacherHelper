import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { switchMap } from 'rxjs';

import { Config } from '../config';

export const auth0TokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth0 = inject(Auth0Service);

  // Only attach Auth0 access tokens to our own backend API calls.
  // This avoids sending tokens to assets, i18n files, Auth0 itself, etc.
  if (!req.url.startsWith(Config.API_URL)) {
    return next(req);
  }

  // Public auth endpoints from the old local auth flow do not need Auth0 tokens.
  // You can remove these later when the old login/register flow is fully deleted.
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

      return next(authReq);
    }),
  );
};
