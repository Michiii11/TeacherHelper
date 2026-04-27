import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { LoginDTO, UserDTO } from '../model/User';
import { Config } from '../config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn = new BehaviorSubject<boolean>(false);
  loggedIn$ = this.loggedIn.asObservable();

  constructor(private http: HttpClient) {
    this.hasValidToken().subscribe(isValid => {
      this.loggedIn.next(isValid);
    });
  }

  login(login: LoginDTO): Observable<any> {
    return this.http.post(Config.API_URL + '/user/login', login);
  }

  validateToken(token: string): Observable<boolean> {
    return this.http.post<{ valid: boolean }>(
      Config.API_URL + '/user/validate', {},
      { headers: { Authorization: localStorage.getItem('teacher_authToken') ?? '' } }
    ).pipe(
      map(response => response.valid)
    );
  }

  private hasValidToken(): Observable<boolean> {
    const token = localStorage.getItem('teacher_authToken');
    if (!token) {
      return of(false);
    }

    return this.validateToken(token).pipe(
      catchError(() => of(false))
    );
  }

  setLogin(token: string, userId: string) {
    localStorage.setItem('teacher_authToken', token);
    localStorage.setItem('teacher_userId', userId);
    this.loggedIn.next(true);
  }

  isAdmin(): Observable<boolean> {
    const authToken = localStorage.getItem('teacher_authToken');

    if (!authToken) {
      return of(false);
    }

    return this.http.get<{ isAdmin: boolean }>(
      `${Config.API_URL}/user/isAdmin`,
      {
        headers: { Authorization: authToken }
      }
    ).pipe(
      map(response => !!response.isAdmin),
      catchError(() => of(false))
    );
  }
}
