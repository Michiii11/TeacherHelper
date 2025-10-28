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

  getSchoolById(schoolId: string) {
    return this.http.get<SchoolDTO>(`${Config.API_URL}/school/${schoolId}`);
  }

  addSchool(schoolName: string) {
    return this.http.post<string>(
      Config.API_URL + '/school/add',
      { schoolName, authToken: localStorage.getItem('teacher_authToken') },
      { responseType: 'text' as 'json' }
    );
  }
}
