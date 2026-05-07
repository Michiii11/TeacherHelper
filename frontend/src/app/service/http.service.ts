import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { Config } from '../config';
import { CollectionDTO } from '../model/Collection';
import {
  CreateExampleDTO,
  ExampleDTO,
  ExampleOverviewDTO,
  Focus,
} from '../model/Example';
import { CreateTestDTO } from '../model/Test';
import { AdminDashboardDTO, AuthResult, User, UserDTO, UserSettings } from '../model/User';
import { NotificationActionType, NotificationDTO } from '../model/Notification';
import { CreateFolderDTO, FolderDTO } from '../model/Folder';
import { AppLanguage } from './language.service';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);

  // region Socket
  /** Socket **/
  getNotificationSocketUrl(): string {
    return `${Config.SOCKET_URL}/notification`;
  }

  getCollectionSocketUrl(collectionId: string | null): string {
    return `${Config.SOCKET_URL}/collection/${collectionId}`;
  }
  // endregion

  // region Collection
  /** Collection **/
  getYourCollections() {
    return this.http.get<CollectionDTO[]>(`${Config.API_URL}/collection/your-collections`);
  }

  getCollectionById(collectionId: string) {
    return this.http.get<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}`);
  }

  addCollection(collectionName: string) {
    return this.http.post<string>(`${Config.API_URL}/collection/add`, collectionName);
  }

  deleteCollection(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}`);
  }

  getCollectionLogo(collectionId: string | null) {
    return this.http.get(`${Config.API_URL}/collection/${collectionId}/logo`, {
      responseType: 'blob',
    });
  }

  uploadCollectionLogo(collectionId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}/logo`, formData);
  }

  deleteCollectionLogo(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/logo`);
  }

  leaveCollection(collectionId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/leave`);
  }

  removeTeacher(collectionId: string, teacherId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/remove-teacher/${teacherId}`);
  }

  inviteTeacher(collectionId: string | null, username: string) {
    return this.http.post(`${Config.API_URL}/collection/${collectionId}/invite`, username);
  }

  respondToInvite(inviteId: string, accept: boolean) {
    return this.http.post(`${Config.API_URL}/collection/invite/${inviteId}/respond`, accept);
  }

  updateCollectionSettings(collectionId: string, name: string | undefined) {
    return this.http.put<CollectionDTO>(`${Config.API_URL}/collection/${collectionId}/settings`, name);
  }

  getAllFocus(collectionId: string) {
    return this.http.get<Focus[]>(`${Config.API_URL}/collection/${collectionId}/focus`);
  }

  createFocus(collectionId: string, focus: Focus) {
    return this.http.post<Focus>(`${Config.API_URL}/collection/${collectionId}/focus`, focus);
  }

  deleteFocus(collectionId: string, focusId: string) {
    return this.http.delete(`${Config.API_URL}/collection/${collectionId}/focus/${focusId}`);
  }
  // endregion

  // region Notification
  /** Notification **/
  getMyNotifications(): Observable<NotificationDTO[]> {
    return this.http.get<NotificationDTO[]>(`${Config.API_URL}/notification`);
  }

  markAsRead(notificationId: string) {
    return this.http.put(`${Config.API_URL}/notification/${notificationId}/read`, {});
  }

  deleteNotification(notificationId: string) {
    return this.http.delete(`${Config.API_URL}/notification/${notificationId}`);
  }

  executeAction(notificationId: string, action: NotificationActionType) {
    return this.http.post(`${Config.API_URL}/notification/${notificationId}/action`, action);
  }

  sendSystemInfoToSchool(collectionId: string, payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/collection/${collectionId}`, payload, {
      responseType: 'text',
    });
  }

  sendSystemInfoToAll(payload: { title: string; message: string; link?: string | null }) {
    return this.http.post(`${Config.API_URL}/notification/system-info/all`, payload, {
      responseType: 'text',
    });
  }
  // endregion

  // region Folder
  /** Folder **/
  getFolders(collectionId: string) {
    return this.http.get<FolderDTO[]>(`${Config.API_URL}/folder/collection/${collectionId}`);
  }

  createFolder(collectionId: string, dto: CreateFolderDTO) {
    return this.http.post<FolderDTO>(`${Config.API_URL}/folder/collection/${collectionId}`, dto);
  }

  updateFolder(folderId: string, dto: CreateFolderDTO) {
    return this.http.put<FolderDTO>(`${Config.API_URL}/folder/${folderId}`, dto);
  }

  deleteFolder(folderId: string) {
    return this.http.delete(`${Config.API_URL}/folder/${folderId}`, {
      responseType: 'text',
    });
  }
  // endregion

  // region Example
  /** Example **/
  getExamples(collectionId: string | null) {
    return this.http.get<ExampleOverviewDTO[]>(`${Config.API_URL}/example/collection/${collectionId}`);
  }

  getFullExamples(collectionId: string) {
    return this.http.get<ExampleDTO[]>(`${Config.API_URL}/example/collection/${collectionId}/full`);
  }

  getExample(exampleId: string) {
    return this.http.get<CreateExampleDTO>(`${Config.API_URL}/example/${exampleId}`);
  }

  createExample(dto: CreateExampleDTO) {
    return this.http.post(`${Config.API_URL}/example`, dto, {
      responseType: 'text',
    });
  }

  deleteExample(id: string) {
    return this.http.delete(`${Config.API_URL}/example/${id}`);
  }

  updateExample(exampleId: string, dto: CreateExampleDTO) {
    return this.http.put(`${Config.API_URL}/example/${exampleId}`, dto, {
      responseType: 'text',
    });
  }

  moveExampleToFolder(exampleId: string, folderId: string | null) {
    return this.http.put(`${Config.API_URL}/example/${exampleId}/folder/${folderId}`, {});
  }

  getExampleImage(exampleId: string, isSolution: boolean) {
    return this.http.get(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`, {
      responseType: 'blob',
    });
  }

  async getExampleImageObjectUrl(exampleId: string, isSolution: boolean): Promise<string> {
    const blob = await firstValueFrom(this.getExampleImage(exampleId, isSolution));
    return URL.createObjectURL(blob);
  }

  uploadExampleImage(exampleId: string, file: File, isSolution: boolean) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`, formData, {
      responseType: 'text',
    });
  }

  deleteExampleImage(exampleId: string, isSolution: boolean) {
    return this.http.delete(`${Config.API_URL}/example/${exampleId}/image/${isSolution}`, {
      responseType: 'text',
    });
  }
  // endregion

  // region Test
  /** Test **/
  getTests(collectionId: string | null) {
    return this.http.get(`${Config.API_URL}/test/collection/${collectionId}`);
  }

  getTest(testId: string) {
    return this.http.get<CreateTestDTO>(`${Config.API_URL}/test/${testId}`);
  }

  createTest(test: CreateTestDTO) {
    return this.http.post(`${Config.API_URL}/test`, test);
  }

  updateTest(testId: string | undefined, test: CreateTestDTO) {
    return this.http.put(`${Config.API_URL}/test/${testId}`, test);
  }

  deleteTest(id: string) {
    return this.http.delete(`${Config.API_URL}/test/${id}`);
  }

  moveTestToFolder(testId: string, folderId: string | null) {
    return this.http.put(`${Config.API_URL}/test/${testId}/folder/${folderId}`, {});
  }
  // endregion

  // region User
  /** User **/
  getUsernames() {
    return this.http.get<string[]>(`${Config.API_URL}/user/list`);
  }

  // Legacy endpoint. With Auth0 registration usually happens via Auth0, not here.
  register(payload: {
    username: string;
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/register`, payload);
  }

  // Legacy endpoint. With Auth0 login usually happens via Auth0, not here.
  login(payload: {
    email: string;
    password: string;
    language?: 'de' | 'en' | null;
    darkMode?: boolean | null;
  }) {
    return this.http.post<AuthResult>(`${Config.API_URL}/user/login`, payload);
  }

  verifyRegistrationCode(payload: { email: string; code: string }) {
    return this.http.post(`${Config.API_URL}/user/verify-code`, payload, {
      responseType: 'text',
    });
  }

  verifyEmail(token: string) {
    return this.http.get(`${Config.API_URL}/user/verify-email?token=${encodeURIComponent(token)}`, {
      responseType: 'text',
    });
  }

  resendVerification(email: string, language: AppLanguage | null) {
    const lang = language ? `?language=${encodeURIComponent(language)}` : '';
    return this.http.post(`${Config.API_URL}/user/email/resend-verification${lang}`, { email }, {
      responseType: 'text',
    });
  }

  getUserId() {
    return this.http.get<string>(`${Config.API_URL}/user/me/id`);
  }

  getUser() {
    return this.http.get<User>(`${Config.API_URL}/user/me`);
  }

  getServer() {
    return this.http.get(`${Config.API_URL}/user/server`);
  }

  deleteAccount() {
    return this.http.delete(`${Config.API_URL}/user`, {
      responseType: 'text',
    });
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.put(`${Config.API_URL}/user/password`, {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    }, {
      responseType: 'text',
    });
  }

  forgotPassword(email: string, language: string | null) {
    return this.http.post(`${Config.API_URL}/user/password/forgot`, { email, language }, {
      responseType: 'text',
    });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${Config.API_URL}/user/password/reset`, newPassword, {
      headers: { ResetToken: token },
      responseType: 'text',
    });
  }

  updateUsername(username: string) {
    return this.http.put(`${Config.API_URL}/user/username`, username, {
      responseType: 'text',
    });
  }

  requestEmailChange(email: string) {
    return this.http.put<string>(`${Config.API_URL}/user/email`, email);
  }

  cancelPendingEmailChange() {
    return this.http.post(`${Config.API_URL}/user/email/cancel-pending`, {}, {
      responseType: 'text',
    });
  }

  updateUserSettings(settings: UserSettings) {
    return this.http.put(`${Config.API_URL}/user/settings`, settings);
  }

  uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${Config.API_URL}/user/profile-image`, formData, {
      responseType: 'text',
    });
  }

  getProfileImage(userId: string) {
    return this.http.get(`${Config.API_URL}/user/profile-image/${userId}`, {
      responseType: 'blob',
    });
  }

  async getProfileImageObjectUrl(userId: string): Promise<string> {
    const blob = await firstValueFrom(this.getProfileImage(userId));
    return URL.createObjectURL(blob);
  }

  deleteProfileImage() {
    return this.http.delete<string>(`${Config.API_URL}/user/profile-image`);
  }

  getAdminDashboard() {
    return this.http.get<AdminDashboardDTO>(`${Config.API_URL}/user/admin`);
  }

  getUserAdminDashboard(userId: string) {
    return this.http.get(`${Config.API_URL}/user/admin/${userId}`);
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
    return this.http.post<{ valid: boolean }>(`${Config.API_URL}/user/validate`, {}).pipe(
      map(response => response.valid),
      catchError(() => of(false)),
    );
  }

  isAdmin(): Observable<boolean> {
    return this.http.get<{ isAdmin: boolean }>(`${Config.API_URL}/user/isAdmin`).pipe(
      map(response => response.isAdmin),
      catchError(() => of(false)),
    );
  }
  // endregion
}
