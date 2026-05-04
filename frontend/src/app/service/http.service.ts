import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {firstValueFrom, Observable, of} from 'rxjs';
import { Config } from '../config';
import { CollectionDTO } from '../model/Collection';
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
import {catchError, map} from 'rxjs/operators'

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

  getCollectionSocketUrl(collectionId: string | null): string {
    const token = this.authToken();
    return `${Config.SOCKET_URL}/collection/${collectionId}?token=${encodeURIComponent(token)}`;
  }
  // endregion

  // region Collection
  /** Collection **/
  getYourCollections() {
    return this.http.get<CollectionDTO[]>(`${Config.API_URL}/collection/your-collections`,
      { headers: { Authorization: this.authToken() }});
  }

  getCollectionById(collectionId: string) {
    return this.http.get<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}`,
      { headers: { Authorization: this.authToken() }});
  }

  addCollection(collectionName: string) {
    return this.http.post<string>(
      `${Config.API_URL}/collection/add`, collectionName,
      { headers: { Authorization: this.authToken() }}
    );
  }

  deleteCollection(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}`, {
      headers: { Authorization: this.authToken() }});
  }

  getCollectionLogo(collectionId: string | null) {
    return this.http.get(`${Config.API_URL}/collection/${collectionId}/logo`, {
      headers: { Authorization: this.authToken() },
      responseType: 'blob'
    });
  }
  uploadCollectionLogo(collectionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}/logo`, formData,
      { headers: { Authorization: this.authToken() }} );
  }

  deleteCollectionLogo(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/logo`, {
      headers: { Authorization: this.authToken() }});
  }

  leaveCollection (collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/leave`, {
      headers: { Authorization: this.authToken() }
    })
  }

  removeTeacher(collectionId: string, teacherId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/remove-teacher/${teacherId}`, {
      headers: { Authorization: this.authToken() }});
  }

  inviteTeacher(collectionId: string | null, username: string) {
    return this.http.post(`${Config.API_URL}/collection/${collectionId}/invite`, username,
      {headers: { Authorization: this.authToken() }});
  }

  respondToInvite(inviteId: string, accept: boolean) {
    return this.http.post(`${Config.API_URL}/collection/invite/${inviteId}/respond`, accept,
      {headers: { Authorization: this.authToken() }});
  }

  updateCollectionSettings(collectionId: string, name: string | undefined) {
    return this.http.put<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}/settings`, name,
      { headers: { Authorization: this.authToken() }});
  }

  getAllFocus(collectionId: string) {
    return this.http.get<Focus[]>(`${Config.API_URL}/collection/${collectionId}/focus`,
      { headers: { Authorization: this.authToken() }});
  }

  createFocus(collectionId: string, focus: Focus) {
    return this.http.post<Focus>(`${Config.API_URL}/collection/${collectionId}/focus`, focus,
      { headers: { Authorization: this.authToken() }});
  }

  deleteFocus(collectionId: string, focusId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/focus/${focusId}`, {
      headers: { Authorization: this.authToken() }});
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

  sendSystemInfoToSchool(collectionId: string, payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/collection/${collectionId}`, payload, {
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
  getFolders(collectionId: string) {
    return this.http.get<FolderDTO[]>(`${Config.API_URL}/folder/collection/${collectionId}`,
      { headers: { Authorization: this.authToken() }});
  }

  createFolder(collectionId: string, dto: CreateFolderDTO) {
    return this.http.post<FolderDTO>(`${Config.API_URL}/folder/collection/${collectionId}`, dto,
      { headers: {Authorization: this.authToken() }});
  }

  updateFolder(folderId: string, dto: CreateFolderDTO) {
    return this.http.put<FolderDTO>(`${Config.API_URL}/folder/${folderId}`, dto,
      { headers: { Authorization: this.authToken() }});
  }

  deleteFolder(folderId: string) {
    return this.http.delete(`${Config.API_URL}/folder/${folderId}`,
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }
  // endregion

  // region Example
  /** Example **/
  getExamples(collectionId: string | null) {
    return this.http.get<ExampleOverviewDTO[]>(`${Config.API_URL}/example/collection/${collectionId}`,
      { headers: { Authorization: this.authToken() }});
  }

  getFullExamples(collectionId: string) {
    return this.http.get<ExampleDTO[]>(`${Config.API_URL}/example/collection/${collectionId}/full`,
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
      `${Config.API_URL}/example/${exampleId}/folder/${folderId}`, {},
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

  // region Test
  /** Test **/
  getTests(collectionId: string | null) {
    return this.http.get(`${Config.API_URL}/test/collection/${collectionId}`,
      { headers: { Authorization: this.authToken() }});
  }

  getTest(testId: string) {
    return this.http.get<CreateTestDTO>(`${Config.API_URL}/test/${testId}`,
      { headers: { Authorization: this.authToken() } });
  }

  createTest(test: CreateTestDTO) {
    return this.http.post(`${Config.API_URL}/test`, test,
      { headers: { Authorization: this.authToken() }});
  }

  updateTest(testId: string | undefined, test: CreateTestDTO) {
    return this.http.put(`${Config.API_URL}/test/${testId}`, test,
      { headers: { Authorization: this.authToken() }});
  }

  deleteTest(id: string) {
    return this.http.delete(`${Config.API_URL}/test/${id}`,
      { headers: { Authorization: this.authToken() } });
  }

  moveTestToFolder(testId: string, folderId: string | null) {
    return this.http.put(
      `${Config.API_URL}/test/${testId}/folder/${folderId}`, {},
      { headers: { Authorization: this.authToken() }});
  }
  // endregion

  // region User
  /** User **/
  getUsernames(){
    return this.http.get<string[]>(`${Config.API_URL}/user/list`,
      { headers: { Authorization: this.authToken() }});
  }

  register(payload: {
    username: string;
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/register`, payload);
  }

  login(payload: {
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/login`, payload);
  }

  verifyEmail(token: string) {
    return this.http.get(`${Config.API_URL}/user/verify-email?token=${encodeURIComponent(token)}`,
      { responseType: 'text' });
  }

  resendVerification(email: string, language: AppLanguage | null) {
    const lang = language ? `?language=${encodeURIComponent(language)}` : '';
    return this.http.post(`${Config.API_URL}/user/email/resend-verification${lang}`,
      { email }, { responseType: 'text' });
  }

  getUserId() {
    return this.http.get<string>(`${Config.API_URL}/user/id`,
      { headers: { Authorization: this.authToken() }});
  }

  getUser() {
    return this.http.get<User>(`${Config.API_URL}/user`,
      { headers: { Authorization: this.authToken() } });
  }

  getServer() {
    return this.http.get(`${Config.API_URL}/user/server`);
  }

  deleteAccount(password: string) {
    return this.http.delete(`${Config.API_URL}/user`, {
      headers: { Authorization: this.authToken() }, body: { password }, responseType: 'text'
    });
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.put(`${Config.API_URL}/user/password`,
      { currentPassword: payload.currentPassword, newPassword: payload.newPassword },
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }

  forgotPassword(email: string, language: string | null) {
    return this.http.post(`${Config.API_URL}/user/password/forgot`, {email, language},
      { responseType: 'text' });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${Config.API_URL}/user/password/reset`, newPassword,
      { headers: { ResetToken: token } , responseType: 'text' });
  }

  updateUsername(username: string) {
    return this.http.put(
      `${Config.API_URL}/user/username`, username,
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }

  requestEmailChange(email: string) {
    return this.http.put<string>(
      `${Config.API_URL}/user/email`, email,
      { headers: { Authorization: this.authToken() } }
    );
  }

  cancelPendingEmailChange() {
    return this.http.post(`${Config.API_URL}/user/email/cancel-pending`, {},
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }

  updateUserSettings(settings: UserSettings) {
    return this.http.put(`${Config.API_URL}/user/settings`, settings,
      { headers: { Authorization: this.authToken() } });
  }

  uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${Config.API_URL}/user/profile-image`, formData,
      { headers: { Authorization: this.authToken() }, responseType: 'text' });
  }

  getProfileImage(userId: string) {
    return this.http.get(`${Config.API_URL}/user/profile-image/${userId}`, {
      headers: { Authorization: this.authToken() },
      responseType: 'blob'
    });
  }

  async getProfileImageObjectUrl(userId: string): Promise<string> {
    const blob = await firstValueFrom(this.getProfileImage(userId));
    return URL.createObjectURL(blob);
  }

  deleteProfileImage() {
    return this.http.delete<string>(`${Config.API_URL}/user/profile-image`,
      { headers: { Authorization: this.authToken() }});
  }

  getAdminDashboard(){
    return this.http.get<AdminDashboardDTO>(`${Config.API_URL}/user/admin`,
      { headers: { Authorization: this.authToken() }});
  }

  getUserAdminDashboard(userId: string) {
    return this.http.get(`${Config.API_URL}/user/admin/${userId}`,
      { headers: { Authorization: this.authToken() }});
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

  validateToken(): Observable<boolean> {
    return this.http.post<{ valid: boolean }>(
      Config.API_URL + '/user/validate', {},
      { headers: { Authorization: this.authToken() }}
    ).pipe(
      map(response => response.valid)
    );
  }

  isAdmin(): Observable<boolean> {
    return this.http.get<{ isAdmin: boolean }>(
      `${Config.API_URL}/user/isAdmin`,
      {
        headers: { Authorization: this.authToken() }
      }
    ).pipe(
      map(response => response.isAdmin),
      catchError(() => of(false))
    );
  }
  // endregion
}
