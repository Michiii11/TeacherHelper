import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Config } from '../config';
import { CreateSchoolInviteDTO, SchoolDTO } from '../model/School';
import { CreateExampleDTO, Focus } from '../model/Example';
import { CreateTestDTO } from '../model/Test';
import { User } from '../model/User';
import { NotificationActionType, NotificationDTO } from '../model/Notification';

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);

  private authToken(): string {
    return localStorage.getItem('teacher_authToken') ?? '';
  }

  getNotificationSocketUrl(): string {
    const token = this.authToken();

    return `${Config.SOCKET_URL}/notification?token=${encodeURIComponent(token)}`;
  }

  getSchools() {
    return this.http.get<SchoolDTO[]>(`${Config.API_URL}/school`);
  }

  getSchoolById(schoolId: string) {
    return this.http.post<SchoolDTO>(
      `${Config.API_URL}/school/${schoolId}`,
      this.authToken(),
      { headers: { 'Content-Type': 'text/plain' } }
    );
  }

  addSchool(schoolName: string) {
    return this.http.post<string>(
      `${Config.API_URL}/school/add`,
      { schoolName, authToken: this.authToken() },
      { responseType: 'text' as 'json' }
    );
  }

  getYourSchools() {
    return this.http.post<SchoolDTO[]>(
      `${Config.API_URL}/school/your-schools`,
      this.authToken()
    );
  }

  getAllTeachers(schoolId: number | string) {
    return this.http.get(`${Config.API_URL}/school/${schoolId}/rest`);
  }

  kickTeacherFromSchool(s: string, id: number) {
    return this.http.delete(`${Config.API_URL}/school/${s}/remove-teacher`, {
      body: { teacherId: id, authToken: this.authToken() }
    });
  }

  getAllFocus(schoolId: number) {
    return this.http.get<Focus[]>(`${Config.API_URL}/school/${schoolId}/focus`);
  }

  createFocus(schoolId: number, focus: Focus) {
    return this.http.post<Focus>(`${Config.API_URL}/school/${schoolId}/focus`, focus);
  }

  deleteFocus(schoolId: number, id: number) {
    return this.http.delete(`${Config.API_URL}/school/${schoolId}/focus/${id}`, {
      body: { authToken: this.authToken() },
      responseType: 'text' as 'json'
    });
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
    return this.http.delete(`${Config.API_URL}/example/${id}`, {
      body: { authToken: this.authToken() },
      responseType: 'text' as 'json'
    });
  }

  getFullExamples(schoolId: number) {
    return this.http.get(`${Config.API_URL}/example/school/${schoolId}/full`);
  }

  getCreateExample(exampleId: number) {
    return this.http.post<CreateExampleDTO>(`${Config.API_URL}/example/${exampleId}`, {
      authToken: this.authToken()
    });
  }

  getTests(schoolId: string | null) {
    return this.http.get(`${Config.API_URL}/test/school/${schoolId}`);
  }

  getCreateTest(testId: number) {
    return this.http.post<CreateTestDTO>(`${Config.API_URL}/test/${testId}`, {
      authToken: this.authToken()
    });
  }

  createTest(test: CreateTestDTO) {
    return this.http.post(`${Config.API_URL}/test`, test, { responseType: 'text' as 'json' });
  }

  deleteTest(id: number) {
    return this.http.delete(`${Config.API_URL}/test/${id}`, {
      body: { authToken: this.authToken() },
      responseType: 'text' as 'json'
    });
  }

  saveTest(testId: number, test: CreateTestDTO) {
    return this.http.put(`${Config.API_URL}/test/${testId}`, test, { responseType: 'text' as 'json' });
  }

  getUserId() {
    return this.http.post<number>(`${Config.API_URL}/user/id`, this.authToken());
  }

  getUser() {
    return this.http.post<User>(`${Config.API_URL}/user`, this.authToken());
  }

  getMyNotifications(): Observable<NotificationDTO[]> {
    return this.http.post<NotificationDTO[]>(`${Config.API_URL}/notification/my`, this.authToken(), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  markAsRead(id: number) {
    return this.http.post(`${Config.API_URL}/notification/${id}/read`, this.authToken(), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  deleteNotification(id: number) {
    return this.http.delete(`${Config.API_URL}/notification/${id}`, {
      body: this.authToken(),
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  executeAction(id: number, action: NotificationActionType) {
    return this.http.post(`${Config.API_URL}/notification/${id}/action`, {
      authToken: this.authToken(),
      action
    });
  }

  sendSystemInfoToSchool(schoolId: number, payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/school/${schoolId}`, {
      authToken: this.authToken(),
      ...payload
    }, {
      responseType: 'text'
    });
  }

  sendSystemInfoToAll(payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/all`, {
      authToken: this.authToken(),
      ...payload
    }, {
      responseType: 'text'
    });
  }

  respondToInvite(inviteId: number, accept: boolean) {
    return this.http.post(`${Config.API_URL}/school/invite/${inviteId}/respond`, {
      authToken: this.authToken(),
      accept
    });
  }

  respondToJoinRequest(inviteId: number, accept: boolean) {
    return this.http.post(`${Config.API_URL}/school/join-request/${inviteId}/respond`, {
      authToken: this.authToken(),
      accept
    });
  }

  sendJoinRequest(id: number, result: any) {
    return this.http.post(`${Config.API_URL}/school/${id}/join-request`, {
      authToken: this.authToken(),
      message: result.message
    });
  }

  inviteTeacher(id: string | number, dto: CreateSchoolInviteDTO) {
    dto.authToken = this.authToken();
    return this.http.post(`${Config.API_URL}/school/${id}/invite-teacher`, dto);
  }
}
