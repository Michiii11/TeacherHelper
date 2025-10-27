import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http'
import {Observable} from 'rxjs'
import {LoginDTO, UserDTO} from '../model/User'
import {Config} from '../config'
import {map} from "rxjs/operators"


@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}

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
}
