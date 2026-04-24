import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {firstValueFrom, Observable} from 'rxjs';
import { Config } from '../config';
import { SchoolDTO } from '../model/School';
import {
  CreateExampleDTO, ExampleDTO, ExampleOverviewDTO,
  Focus,
} from '../model/Example';
import {
  CreateTestDTO
} from '../model/Test';
import {AdminDashboardDTO, AuthResult, User, UserDTO, UserSettings} from '../model/User';
import { NotificationActionType, NotificationDTO } from '../model/Notification';
import {CreateFolderDTO, FolderDTO} from '../model/Folder'
import {AppLanguage} from './language.service'

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);

  private authToken(): string {
    return localStorage.getItem('teacher_authToken') ?? '';
  }

  // region Socket
  /** Socket **/
  getNotificationSocketUrl(): string {
    const token = this.authToken();
    return `${Config.SOCKET_URL}/notification?token=${encodeURIComponent(token)}`;
  }
  // endregion

  // region Collection
  /** Collection **/
  getYourCollections() {
    return this.http.get<SchoolDTO[]>(`${Config.API_URL}/school/your-collections`,
    { headers: { Authorization: this.authToken() }});
  }

  getCollectionById(collectionId: string) {
    return this.http.get<SchoolDTO>(`${Config.API_URL}/school/${collectionId}`,
      { headers: { Authorization: this.authToken() }});
  }

  addCollection(collectionName: string) {
    return this.http.post<string>(
      `${Config.API_URL}/school/add`, collectionName,
      { headers: { Authorization: this.authToken() }}
    );
  }

  deleteCollection(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/school/${collectionId}`, {
      headers: { Authorization: this.authToken() }});
  }

  getCollectionLogo(collectionId: string) {
    return this.http.get(`${Config.API_URL}/school/${collectionId}/logo`, {
      headers: { Authorization: this.authToken() },
      responseType: 'blob'
    });
  }
  uploadCollectionLogo(collectionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<SchoolDTO>(`${Config.API_URL}/school/${collectionId}/logo`, formData,
      { headers: { Authorization: this.authToken() }} );
  }

  deleteCollectionLogo(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/school/${collectionId}/logo`, {
      headers: { Authorization: this.authToken() }});
  }

  leaveCollection (collectionId: string) {
    return this.http.delete(`${Config.API_URL}/school/${collectionId}/leave`, {
      headers: { Authorization: this.authToken() }
    })
  }

  removeTeacher(collectionId: string, teacherId: string) {
    return this.http.delete(`${Config.API_URL}/school/${collectionId}/remove-teacher/${teacherId}`, {
      headers: { Authorization: this.authToken() }});
  }

  inviteTeacher(collectionId: string | null, email: string) {
    return this.http.post(`${Config.API_URL}/school/${collectionId}/invite`, email,
      {headers: { Authorization: this.authToken() }});
  }

  respondToInvite(inviteId: string, accept: boolean) {
    return this.http.post(`${Config.API_URL}/school/invite/${inviteId}/respond`, accept,
      {headers: { Authorization: this.authToken() }});
  }

  updateCollectionSettings(collectionId: string, name: string | undefined) {
    return this.http.put<SchoolDTO>(`${Config.API_URL}/school/${collectionId}/settings`, name,
      { headers: { Authorization: this.authToken() }});
  }

  getAllFocus(schoolId: string) {
    return this.http.get<Focus[]>(`${Config.API_URL}/school/${schoolId}/focus`,
      { headers: { Authorization: this.authToken() }});
  }

  createFocus(schoolId: string, focus: Focus) {
    return this.http.post<Focus>(`${Config.API_URL}/school/${schoolId}/focus`, focus,
      { headers: { Authorization: this.authToken() }});
  }

  deleteFocus(schoolId: string, focusId: string) {
    return this.http.delete(`${Config.API_URL}/school/${schoolId}/focus/${focusId}`, {
      headers: { Authorization: this.authToken() }});
  }
  // endregion

  // region User
  /** User **/
  register(payload: {
    username: string;
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/register`, payload);
  }

  getUserId() {
    return this.http.post<string>(`${Config.API_URL}/user/id`, this.authToken());
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

  login(payload: {
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/login`, payload);
  }

  setUserLocked(userId: string, locked: boolean) {
    return this.http.put(
      `${Config.API_URL}/user/admin/${userId}/locked`,
      {
        authToken: this.authToken(),
        locked
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

  resendVerification(email: string, language: AppLanguage | null) {
    return this.http.post(`${Config.API_URL}/user/email/resend-verification?language=${language}`, { email }, {
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

  // endregion

  // region Notification
  /** Notification **/
  getMyNotifications(): Observable<NotificationDTO[]> {
    return this.http.get<NotificationDTO[]>(`${Config.API_URL}/notification`, {
      headers: { Authorization: this.authToken() }});
  }

  markAsRead(notificationId: string) {
    return this.http.put(`${Config.API_URL}/notification/${notificationId}/read`, {}, {
      headers: { Authorization: this.authToken() } });
  }

  deleteNotification(notificationId: string) {
    return this.http.delete(`${Config.API_URL}/notification/${notificationId}`, {
      headers: { Authorization: this.authToken() }});
  }

  executeAction(notificationId: string, action: NotificationActionType) {
    return this.http.post(`${Config.API_URL}/notification/${notificationId}/action`, action, {
      headers: { Authorization: this.authToken() }});
  }

  sendSystemInfoToSchool(schoolId: string, payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/school/${schoolId}`, payload, {
      headers: { Authorization: this.authToken()},
      responseType: 'text'});
  }

  sendSystemInfoToAll(payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/all`, payload, {
      headers: { Authorization: this.authToken() },
      responseType: 'text'});
  }
  // endregion

  // region Folder
  /** Folder **/
  getFolders(schoolId: string) {
    return this.http.get<FolderDTO[]>(`${Config.API_URL}/folder/school/${schoolId}`,
      { headers: { Authorization: this.authToken() }});
  }

  createFolder(schoolId: string, dto: CreateFolderDTO) {
    return this.http.post<FolderDTO>(`${Config.API_URL}/folder/school/${schoolId}`, dto,
      { headers: {Authorization: this.authToken() }});
  }

  updateFolder(folderId: string, dto: CreateFolderDTO) {
    return this.http.put<FolderDTO>(`${Config.API_URL}/folder/${folderId}`, dto);
  }

  deleteFolder(folderId: string) {
    return this.http.delete(`${Config.API_URL}/folder/${folderId}`,
      { headers: { Authorization: this.authToken() }});
  }
  // endregion

  // region Example
  /** Example **/
  getExamples(schoolId: string | null) {
    return this.http.get<ExampleOverviewDTO[]>(`${Config.API_URL}/example/school/${schoolId}`,
      { headers: { Authorization: this.authToken() }});
  }

  getFullExamples(schoolId: string) {
    return this.http.get<ExampleDTO[]>(`${Config.API_URL}/example/school/${schoolId}/full`,
      { headers: { Authorization: this.authToken() }});
  }

  getExample(exampleId: string) {
    return this.http.get<CreateExampleDTO>(`${Config.API_URL}/example/${exampleId}`,
      { headers: { Authorization: this.authToken() }});
  }

  createExample(dto: CreateExampleDTO) {
    return this.http.post(`${Config.API_URL}/example`, dto,
      { headers: { Authorization: this.authToken() }, responseType: 'text'});
  }

  deleteExample(id: string) {
    return this.http.delete(`${Config.API_URL}/example/${id}`,
      { headers: { Authorization: this.authToken() }});
  }

  updateExample(exampleId: string, dto: CreateExampleDTO) {
    return this.http.put(`${Config.API_URL}/example/${exampleId}`, dto,
      { headers: { Authorization: this.authToken() }, responseType: 'text'});
  }

  moveExampleToFolder(exampleId: string, folderId: string | null) {
    return this.http.put(
      `${Config.API_URL}/example/${exampleId}/folder`, folderId,
      { headers: { Authorization: this.authToken() }});
  }

  getExampleImage(exampleId: string, isSolution: boolean) {
    return this.http.get(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`, {
      headers: { Authorization: this.authToken() },
      responseType: 'blob'
    });
  }

  async getExampleImageObjectUrl(exampleId: string, isSolution: boolean): Promise<string> {
    const blob = await firstValueFrom(this.getExampleImage(exampleId, isSolution));
    return URL.createObjectURL(blob);
  }

  uploadExampleImage(exampleId: string, file: File, isSolution: boolean) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`, formData,
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }

  deleteExampleImage(exampleId: string, isSolution: boolean) {
    return this.http.delete(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`,
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }


  // endregion





  moveTestToFolder(testId: string, dto: { folderId: string | null }) {
    return this.http.put(
      `${Config.API_URL}/test/${testId}/folder`,
      {...dto, authToken: this.authToken()},
      {responseType: 'text' as 'json'}
    );
  }

  getTests(schoolId: string | null) {
    return this.http.get(`${Config.API_URL}/test/school/${schoolId}`);
  }

  getCreateTest(testId: string) {
    return this.http.post<CreateTestDTO>(`${Config.API_URL}/test/${testId}`, {
      authToken: this.authToken()
    });
  }

  createTest(test: CreateTestDTO) {
    console.log(test)
    return this.http.post(`${Config.API_URL}/test`, test, { responseType: 'text' as 'json' });
  }

  deleteTest(id: string) {
    return this.http.delete(`${Config.API_URL}/test/${id}`, {
      body: { authToken: this.authToken() },
      responseType: 'text' as 'json'
    });
  }

  saveTest(testId: string | undefined, test: CreateTestDTO) {
    return this.http.put(`${Config.API_URL}/test/${testId}`, test, { responseType: 'text' as 'json' });
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

  getUserInitials(user: User | null | UserDTO): string {
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



  getAdminDashboard(){
    return this.http.post<AdminDashboardDTO>(`${Config.API_URL}/user/admin`, this.authToken());
  }
}
