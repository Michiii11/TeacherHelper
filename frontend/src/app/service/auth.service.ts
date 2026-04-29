import {inject, Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { LoginDTO, UserDTO } from '../model/User';
import { Config } from '../config';
import {HttpService} from './http.service'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn = new BehaviorSubject<boolean>(false);
  private http = inject(HttpService)
  loggedIn$ = this.loggedIn.asObservable();

  constructor() {
    this.hasValidToken().subscribe(isValid => {
      this.loggedIn.next(isValid);
    });
  }

  private hasValidToken(): Observable<boolean> {
    const token = localStorage.getItem('teacher_authToken');
    if (!token) {
      return of(false);
    }

    return this.http.validateToken().pipe(
      catchError(() => of(false))
    );
  }

  setLogin(token: string, userId: string) {
    localStorage.setItem('teacher_authToken', token);
    localStorage.setItem('teacher_userId', userId);
    this.loggedIn.next(true);
  }
}
