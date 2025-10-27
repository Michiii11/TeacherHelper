import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Config } from '../config';
import {School, SchoolDTO} from '../model/School'

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);


  getSchools() {
    return this.http.get<SchoolDTO[]>(`${Config.API_URL}/school`);
  }

  addSchool(schoolName: string) {
    return this.http.post(
      Config.API_URL + '/school/add', {schoolName, authToken: localStorage.getItem('teacher_authToken')},
    )
  }
}
