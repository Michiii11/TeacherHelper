import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Config } from '../config';
import {School, SchoolDTO} from '../model/School'
import {CreateExampleDTO} from '../model/Example'

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

  getYourSchools() {
    return this.http.post<SchoolDTO[]>(Config.API_URL + '/school/your-schools',
      localStorage.getItem('teacher_authToken'));
  }

  getExamples(schoolId: string | null) {
    return this.http.get(`${Config.API_URL}/example/school/${schoolId}`);
  }

  createExample(payload: any) {
    return this.http.post(`${Config.API_URL}/example`, payload, { responseType: 'text' as 'json' });
  }

  deleteExample(id: number) {
    return this.http.delete(`${Config.API_URL}/example/${id}`,
      {
        body: { authToken: localStorage.getItem('teacher_authToken')},
        responseType: 'text' as 'json'
      });
  }

  getCreateExample(exampleId: number) {
    return this.http.post<CreateExampleDTO>(`${Config.API_URL}/example/${exampleId}`, {authToken: localStorage.getItem('teacher_authToken')});
  }
}
