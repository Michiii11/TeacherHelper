import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../service/auth.service';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const token = localStorage.getItem('teacher_authToken');
  if (!token) {
    router.navigate(['/login']);
    return of(false);
  }

  return authService.isAdmin().pipe(
    map((isAdmin) => {
      if (isAdmin) {
        return true;
      }

      router.navigate(['/home']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/home']);
      return of(false);
    })
  );
};
