import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {AuthService} from '../service/auth.service'
import {HttpService} from '../service/http.service'

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private httpService: HttpService) {}

  canActivate(): Observable<boolean> {
    const token = localStorage.getItem('teacher_authToken');
    if (!token) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // Token beim Backend validieren
    return this.httpService.validateToken().pipe(
      map(isValid => {
        if (isValid) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      }),
      catchError(() => {
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
