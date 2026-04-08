import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Config } from '../config';
import { ChangeLog, CreateSchoolInviteDTO, LastActivityDTO, SchoolDTO } from '../model/School';
import { CreateExampleDTO, Focus } from '../model/Example';
import { CreateTestDTO } from '../model/Test';
import { AuthResult, User, UserDTO, UserSettings } from '../model/User';
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
    return this.http.get<UserDTO[]>(`${Config.API_URL}/school/${schoolId}/rest`);
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

  createExample(dto: CreateExampleDTO) {
    return this.http.post(`${Config.API_URL}/example`, dto, { responseType: 'text' });
  }

  saveExample(exampleId: number, dto: CreateExampleDTO) {
    return this.http.put(`${Config.API_URL}/example/${exampleId}`, dto, { responseType: 'text' });
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

  uploadConstructionImage(exampleId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('authToken', this.authToken());
    return this.http.post(`${Config.API_URL}/example/${exampleId}/construction-image`, formData, { responseType: 'text' });
  }

  uploadConstructionSolutionImage(exampleId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('authToken', this.authToken());
    return this.http.post(`${Config.API_URL}/example/${exampleId}/construction-solution-image`, formData, { responseType: 'text' });
  }

  deleteConstructionImage(exampleId: number) {
    return this.http.delete(`${Config.API_URL}/example/${exampleId}/construction-image`, {
      body: { authToken: this.authToken() },
      responseType: 'text'
    });
  }

  deleteConstructionSolutionImage(exampleId: number) {
    return this.http.delete(`${Config.API_URL}/example/${exampleId}/construction-solution-image`, {
      body: { authToken: this.authToken() },
      responseType: 'text'
    });
  }

  getConstructionImageUrl(exampleId: number | null | undefined): string | null {
    if (!exampleId) {
      return null;
    }

    return `${Config.API_URL}/example/${exampleId}/construction-image`;
  }

  getConstructionSolutionImageUrl(exampleId: number | null | undefined): string | null {
    if (!exampleId) {
      return null;
    }

    return `${Config.API_URL}/example/${exampleId}/construction-solution-image`;
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

  updateUserSettings(settings: UserSettings) {
    return this.http.put(
      `${Config.API_URL}/user/settings`,
      {
        authToken: this.authToken(),
        settings
      },
      { responseType: 'text' as 'json' }
    );
  }

  updateUsername(username: string) {
    return this.http.put(
      `${Config.API_URL}/user/username`,
      {
        authToken: this.authToken(),
        username
      },
      { responseType: 'text' as 'json' }
    );
  }

  updateEmail(email: string) {
    return this.http.put<string>(
      `${Config.API_URL}/user/email`,
      {
        authToken: this.authToken(),
        email
      },
      { responseType: 'text' as 'json' }
    );
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.put(
      `${Config.API_URL}/user/password`,
      {
        authToken: this.authToken(),
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword
      },
      { responseType: 'text' as 'json' }
    );
  }

  uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('authToken', this.authToken());

    return this.http.post(`${Config.API_URL}/user/profile-image`, formData, {
      responseType: 'text'
    });
  }

  verifyEmail(token: string) {
    return this.http.get(`${Config.API_URL}/user/verify-email`, {
      params: { token },
      responseType: 'text'
    });
  }

  resendVerification(email: string) {
    return this.http.post(`${Config.API_URL}/user/email/resend-verification`, { email }, {
      responseType: 'text'
    });
  }

  forgotPassword(email: string) {
    return this.http.post(`${Config.API_URL}/user/password/forgot`, { email }, {
      responseType: 'text'
    });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${Config.API_URL}/user/password/reset`, {
      token,
      newPassword
    }, {
      responseType: 'text'
    });
  }

  updateSubscription(subscriptionModel: 'FREE' | 'PRO' | 'ENTERPRISE') {
    return this.http.put(`${Config.API_URL}/user/subscription`, {
      authToken: this.authToken(),
      subscriptionModel
    }, {
      responseType: 'text'
    });
  }

  login(payload: { email: string; password: string }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/login`, payload);
  }

  register(payload: { username: string; email: string; password: string }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/register`, payload);
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

  inviteTeacher(id: string | number, dto: CreateSchoolInviteDTO) {
    dto.authToken = this.authToken();
    return this.http.post(`${Config.API_URL}/school/${id}/invite-teacher`, dto);
  }

  cancelPendingEmailChange() {
    const authToken = localStorage.getItem('teacher_authToken') ?? '';
    return this.http.post(`${Config.API_URL}/user/email/cancel-pending`, authToken, {
      responseType: 'text'
    });
  }

  deleteAccount(currentPassword: string) {
    return this.http.post(`${Config.API_URL}/user/delete-account`, {
      authToken: localStorage.getItem('teacher_authToken') ?? '',
      currentPassword
    }, {
      responseType: 'text'
    });
  }

  getAvatarUrl(user: User | UserDTO | null): string | null {
    if (!user?.profileImageUrl) {
      return null;
    }

    const token = this.authToken();
    if (!token) {
      return null;
    }

    return `${Config.API_URL}/user/profile-image/${user?.id}`;
  }

  getUserInitials(user: User | null): string {
    const username = user?.username?.trim();

    if (username) {
      return username
        .split(' ')
        .filter(part => part.trim().length > 0)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('');
    }

    return '?';
  }

  deleteProfileImage() {
    return this.http.delete<string>(`${Config.API_URL}/user/profile-image`, {
      body: this.authToken(),
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'text' as 'json'
    });
  }

  getLastChange(schoolId: string | null) {
    return this.http.get<LastActivityDTO>(`${Config.API_URL}/school/${schoolId}/last-activity`);
  }

  updateSchool(schoolId: string, payload: { name?: string }) {
    return this.http.put<SchoolDTO>(`${Config.API_URL}/school/${schoolId}/settings`, payload);
  }

  uploadSchoolLogo(schoolId: string, formData: FormData) {
    return this.http.post<SchoolDTO>(`${Config.API_URL}/school/${schoolId}/logo`, formData);
  }

  getSchoolLogo(school: SchoolDTO, schoolId: string) {
    if (!school?.logoUrl) {
      return null;
    }

    const token = this.authToken();
    if (!token) {
      return null;
    }

    return `${Config.API_URL}/school/${schoolId}/logo`;
  }
}
