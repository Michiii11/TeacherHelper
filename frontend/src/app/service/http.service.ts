import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Config } from '../config';
import {JoinRequestDTO, School, SchoolDTO} from '../model/School'
import {CreateExampleDTO, Focus} from '../model/Example'
import {CreateTestDTO} from '../model/Test'
import {User} from '../model/User'

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);


  getSchools() {
    return this.http.get<SchoolDTO[]>(`${Config.API_URL}/school`);
  }

  getSchoolById(schoolId: string) {
    let authToken = localStorage.getItem('teacher_authToken')
    return this.http.post<SchoolDTO>(`${Config.API_URL}/school/${schoolId}`, authToken);
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

  getExamples(schoolId: string | null | number) {
    return this.http.get(`${Config.API_URL}/example/school/${schoolId}`);
  }

  createExample(payload: any) {
    return this.http.post(`${Config.API_URL}/example`, payload, { responseType: 'text' as 'json' });
  }

  saveExample(id: number, payload: any) {
    return this.http.put(`${Config.API_URL}/example/${id}`, payload, { responseType: 'text' as 'json' });
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

  getTests(schoolId: string | null) {
    return this.http.get(`${Config.API_URL}/test/school/${schoolId}`);
  }

  getCreateTest(testId: number) {
    return this.http.post<CreateTestDTO>(`${Config.API_URL}/test/${testId}`, {authToken: localStorage.getItem('teacher_authToken')});
  }

  getAllFocus(schoolId: number) {
    return this.http.get<Focus[]>(`${Config.API_URL}/school/${schoolId}/focus`);
  }

  createFocus(schoolId: number, focus: Focus) {
    return this.http.post<Focus>(`${Config.API_URL}/school/${schoolId}/focus`, focus);
  }

  deleteFocus(schoolId: number, id: number) {
    return this.http.delete(`${Config.API_URL}/school/${schoolId}/focus/${id}`,
      {
        body: { authToken: localStorage.getItem('teacher_authToken')},
        responseType: 'text' as 'json'
      });
  }

  getFullExamples(schoolId: number) {
    return this.http.get(`${Config.API_URL}/example/school/${schoolId}/full`);
  }

  createTest(test: CreateTestDTO) {
    return this.http.post(`${Config.API_URL}/test`, test, { responseType: 'text' as 'json' });
  }

  deleteTest(id: number) {
    return this.http.delete(`${Config.API_URL}/test/${id}`,
      {
        body: { authToken: localStorage.getItem('teacher_authToken')},
        responseType: 'text' as 'json'
      });
  }

  saveTest(testId: number, test: CreateTestDTO) {
    return this.http.put(`${Config.API_URL}/test/${testId}`, test, { responseType: 'text' as 'json' });
  }

  getUserId() {
    let authToken = localStorage.getItem('teacher_authToken')
    return this.http.post(`${Config.API_URL}/user/id`, authToken);
  }

  sendSchoolJoinRequest(schoolId: number, message: string) {
    return this.http.post(`${Config.API_URL}/school/${schoolId}/join-request`, {
      userToken: localStorage.getItem('teacher_authToken'),
      message
    });
  }

  getUser() {
    let authToken = localStorage.getItem('teacher_authToken')
    return this.http.post<User>(`${Config.API_URL}/user`, authToken);
  }

  getJoinRequests(schoolId: number) {
    let authToken = localStorage.getItem('teacher_authToken')

    return this.http.post<JoinRequestDTO[]>(`${Config.API_URL}/school/${schoolId}/get-join-requests`, authToken);
  }

  getAllTeachers(schoolId: number | string) {
    return this.http.get(`${Config.API_URL}/school/${schoolId}/rest`);
  }

  inviteTeacherToSchool(schoolId: string, id:number) {
    console.log(id)
    return this.http.post(`${Config.API_URL}/school/${schoolId}/invite-teacher`, {
      teacherId: id,
      authToken: localStorage.getItem('teacher_authToken')
    });
  }
}
