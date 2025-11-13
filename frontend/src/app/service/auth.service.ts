import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http'
import {BehaviorSubject, Observable, of} from 'rxjs'
import {LoginDTO, UserDTO} from '../model/User'
import {Config} from '../config'
import {map} from "rxjs/operators"
import {SchoolDTO} from '../model/School'


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

  register(register: UserDTO): Observable<any> {
    return this.http.post(Config.API_URL + '/user/register', register);
  }

  validateToken(token: string): Observable<boolean> {
    return this.http.post<{ valid: boolean }>(
        Config.API_URL + '/user/validate',
        { token }
    ).pipe(
        map(response => response.valid)
    );
  }

  private hasValidToken(): Observable<boolean> {
    const token = localStorage.getItem('teacher_authToken');
    if (!token) {
      return of(false);
    }

    return this.validateToken(token);
  }

  setLogin(token: string, userId: string) {
    localStorage.setItem('teacher_authToken', token);
    localStorage.setItem('teacher_userId', userId);
    this.loggedIn.next(true);
  }

  logout() {
    localStorage.removeItem('teacher_authToken');
    localStorage.removeItem('teacher_userId');
    this.loggedIn.next(false);
  }
}
