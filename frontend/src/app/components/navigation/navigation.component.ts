import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { MatToolbar } from '@angular/material/toolbar';
import { MatAnchor, MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { HttpService } from '../../service/http.service';
import { User } from '../../model/User';
import { NotificationDTO, NotificationActionType, NotificationType } from '../../model/Notification';
import {TranslatePipe} from '@ngx-translate/core'
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle'

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    DatePipe,
    FormsModule,
    MatToolbar,
    MatAnchor,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuTrigger,
    MatButton,
    MatSnackBarModule,
    MatTooltip,
    TranslatePipe,
    MatButtonToggle,
    MatButtonToggleGroup
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent implements OnInit, OnDestroy {
  service = inject(HttpService);
  snackBar = inject(MatSnackBar);

  user: User = {} as User;
  notifications: NotificationDTO[] = [];
  selectedTab: 'open' | 'history' = 'open';
  processingIds = new Set<number>();

  historyExpanded = false;

  showSystemInfoComposer = false;
  isSendingSystemInfo = false;
  systemInfoScope: 'school' | 'all' = 'school';
  systemInfoTitle = '';
  systemInfoMessage = '';
  systemInfoLink = '';

  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private socketDestroyed = false;
  private routerSub?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.refreshNavigationState();

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.refreshNavigationState();
      });

    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('storage', this.handleStorageRefresh);
    this.connectNotificationSocket();
  }

  ngOnDestroy(): void {
    this.socketDestroyed = true;
    this.routerSub?.unsubscribe();

    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('storage', this.handleStorageRefresh);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
  }

  private handleWindowFocus = () => {
    if (!this.isAuthPage()) {
      this.loadUser();
      this.loadNotifications();
    }
  };

  private handleStorageRefresh = () => {
    if (!this.isAuthPage()) {
      this.loadUser();
      this.loadNotifications();
    }
  };

  private refreshNavigationState(): void {
    if (this.isAuthPage()) {
      this.user = {} as User;
      this.notifications = [];
      return;
    }

    this.loadUser();
    this.loadNotifications();
  }

  isAuthPage(): boolean {
    return this.router.url.startsWith('/login');
  }

  private loadUser(): void {
    this.service.getUser().subscribe({
      next: (user) => (this.user = user),
      error: (err) => console.error(err)
    });
  }

  loadNotifications(): void {
    this.service.getMyNotifications().subscribe({
      next: (notifications) => {
        this.notifications = (notifications ?? []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },
      error: (err) => console.error(err)
    });
  }

  private connectNotificationSocket(): void {
    const socketUrl = this.service.getNotificationSocketUrl();

    if (!socketUrl || typeof WebSocket === 'undefined') {
      return;
    }

    if (this.socket && (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    try {
      this.socket = new WebSocket(socketUrl);

      this.socket.onopen = () => {
        console.log('Notification socket verbunden');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = undefined;
        }
      };

      this.socket.onmessage = (event: MessageEvent<string>) => {
        if (event.data === 'refresh' && !this.isAuthPage()) {
          this.loadNotifications();
          this.loadUser();
        }
      };

      this.socket.onerror = (error) => {
        console.error('Notification socket Fehler:', error);
      };

      this.socket.onclose = (event) => {
        console.warn('Notification socket geschlossen:', event.code, event.reason);
        this.socket = undefined;

        if (this.socketDestroyed) {
          return;
        }

        this.reconnectTimer = setTimeout(() => {
          this.connectNotificationSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Notification socket konnte nicht aufgebaut werden:', error);
    }
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read && !this.isHandled(n)).length;
  }

  get openNotifications(): NotificationDTO[] {
    return this.notifications.filter((n) => !this.isHandled(n) && !n.read);
  }

  get historyNotifications(): NotificationDTO[] {
    return this.notifications.filter((n) => this.isHandled(n));
  }

  setTab(tab: 'open' | 'history', event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedTab = tab;
  }

  visibleNotifications(): NotificationDTO[] {
    return this.selectedTab === 'open' ? this.openNotifications : this.historyNotifications;
  }

  isHandled(n: NotificationDTO): boolean {
    return n.read;
  }

  isResultNotification(n: NotificationDTO): boolean {
    return [
      NotificationType.INVITATION_ACCEPTED,
      NotificationType.INVITATION_DECLINED
    ].includes(n.type);
  }

  hasDecisionActions(n: NotificationDTO): boolean {
    const decisionActions = [
      NotificationActionType.ACCEPT_INVITATION,
      NotificationActionType.DECLINE_INVITATION
    ];

    return decisionActions.includes(n.primaryAction as NotificationActionType)
      || decisionActions.includes(n.secondaryAction as NotificationActionType);
  }

  canMarkAsRead(n: NotificationDTO): boolean {
    return !n.read && !this.isHandled(n) && !this.hasDecisionActions(n);
  }

  canDelete(n: NotificationDTO): boolean {
    return this.selectedTab === 'history';
  }

  isNavigationAllowed(n: NotificationDTO): boolean {
    if (!n.link) {
      return false;
    }

    if (this.hasDecisionActions(n)) {
      return false;
    }

    return true;
  }

  toggleAllHistoryExpanded(event: MouseEvent): void {
    event.stopPropagation();
    this.historyExpanded = !this.historyExpanded;
  }

  isHistoryOpen(): boolean {
    return this.selectedTab === 'history' && this.historyExpanded;
  }

  onNotificationClick(n: NotificationDTO): void {
    if (this.hasDecisionActions(n)) {
      return;
    }

    if (!n.read) {
      this.service.markAsRead(n.id).subscribe({
        next: () => {
          n.read = true;
          this.selectedTab = 'history';
        },
        error: (err) => console.error(err)
      });
    }

    if (this.isNavigationAllowed(n)) {
      this.router.navigateByUrl(n.link!);
    }
  }

  runAction(n: NotificationDTO, action: NotificationActionType, event: MouseEvent): void {
    event.stopPropagation();

    if (this.processingIds.has(n.id) || this.isHandled(n)) {
      return;
    }

    if (!n.relatedEntityId && this.requiresRelatedEntity(action)) {
      this.snackBar.open('Diese Nachricht kann nicht verarbeitet werden.', 'Schließen', {
        duration: 3200
      });
      return;
    }

    this.processingIds.add(n.id);

    switch (action) {
      case NotificationActionType.ACCEPT_INVITATION:
        this.service.respondToInvite(n.relatedEntityId!, true).subscribe({
          next: () => {
            this.snackBar.open('Einladung angenommen.', 'OK', { duration: 2200 });
            this.loadNotifications();
            this.loadUser();
          },
          error: (err) => {
            console.error('Fehler beim Annehmen der Einladung:', err);
            this.snackBar.open(this.extractError(err, 'Einladung konnte nicht angenommen werden.'), 'Schließen', {
              duration: 3600
            });
          },
          complete: () => this.processingIds.delete(n.id)
        });
        break;

      case NotificationActionType.DECLINE_INVITATION:
        this.service.respondToInvite(n.relatedEntityId!, false).subscribe({
          next: () => {
            this.snackBar.open('Einladung abgelehnt.', 'OK', { duration: 2200 });
            this.loadNotifications();
            this.loadUser();
          },
          error: (err) => {
            console.error('Fehler beim Ablehnen der Einladung:', err);
            this.snackBar.open(this.extractError(err, 'Einladung konnte nicht abgelehnt werden.'), 'Schließen', {
              duration: 3600
            });
          },
          complete: () => this.processingIds.delete(n.id)
        });
        break;

      default:
        this.service.executeAction(n.id, action).subscribe({
          next: () => {
            this.loadNotifications();
            this.loadUser();
          },
          error: (err) => {
            console.error('Fehler bei Notification-Aktion:', err);
            this.snackBar.open(this.extractError(err, 'Aktion konnte nicht ausgeführt werden.'), 'Schließen', {
              duration: 3600
            });
          },
          complete: () => this.processingIds.delete(n.id)
        });
    }
  }

  deleteNotification(n: NotificationDTO, event: MouseEvent): void {
    event.stopPropagation();

    if (this.processingIds.has(n.id)) {
      return;
    }

    this.processingIds.add(n.id);
    this.service.deleteNotification(n.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((candidate) => candidate.id !== n.id);
        this.snackBar.open('Nachricht gelöscht.', 'OK', { duration: 2200 });
      },
      error: (err) => {
        console.error('Fehler beim Löschen:', err);
        this.snackBar.open(this.extractError(err, 'Nachricht konnte nicht gelöscht werden.'), 'Schließen', {
          duration: 3600
        });
      },
      complete: () => this.processingIds.delete(n.id)
    });
  }

  markAsRead(n: NotificationDTO, event: MouseEvent): void {
    event.stopPropagation();

    if (!this.canMarkAsRead(n) || this.processingIds.has(n.id)) {
      return;
    }

    this.processingIds.add(n.id);
    this.service.markAsRead(n.id).subscribe({
      next: () => {
        n.read = true;
      },
      error: (err) => console.error(err),
      complete: () => this.processingIds.delete(n.id)
    });
  }

  requiresRelatedEntity(action: NotificationActionType): boolean {
    return [
      NotificationActionType.ACCEPT_INVITATION,
      NotificationActionType.DECLINE_INVITATION
    ].includes(action);
  }

  isProcessing(n: NotificationDTO): boolean {
    return this.processingIds.has(n.id);
  }

  getActionLabel(action?: NotificationActionType): string {
    switch (action) {
      case NotificationActionType.ACCEPT_INVITATION:
        return 'Bestätigen';
      case NotificationActionType.DECLINE_INVITATION:
        return 'Ablehnen';
      case NotificationActionType.OPEN_LINK:
        return 'Öffnen';
      case NotificationActionType.MARK_AS_READ:
        return 'Archivieren';
      case NotificationActionType.DELETE:
        return 'Löschen';
      default:
        return 'Aktion';
    }
  }

  getNotificationBadge(n: NotificationDTO): string {
    switch (n.type) {
      case NotificationType.JOIN_REQUEST:
        return 'Anfrage';
      case NotificationType.SCHOOL_INVITATION:
        return 'Einladung';
      case NotificationType.INVITATION_ACCEPTED:
        return 'Bestätigt';
      case NotificationType.INVITATION_DECLINED:
        return 'Abgelehnt';
      case NotificationType.SCHOOL_NEWS:
        return 'News';
      case NotificationType.SYSTEM_INFO:
        return 'System';
      default:
        return 'Info';
    }
  }

  getNotificationIcon(n: NotificationDTO): string {
    switch (n.type) {
      case NotificationType.JOIN_REQUEST:
        return 'person_add';
      case NotificationType.SCHOOL_INVITATION:
        return 'mail';
      case NotificationType.INVITATION_ACCEPTED:
        return 'check_circle';
      case NotificationType.INVITATION_DECLINED:
        return 'cancel';
      case NotificationType.SCHOOL_NEWS:
      case NotificationType.SYSTEM_INFO:
        return 'campaign';
      default:
        return 'notifications';
    }
  }

  getMetaLine(n: NotificationDTO): string {
    const parts: string[] = [];

    if (n.actor?.username) {
      parts.push(n.actor.username);
    }

    if (n.school?.name) {
      parts.push(n.school.name);
    }

    return parts.join(' • ');
  }

  goToSchool(): void {
    const lastId = localStorage.getItem('lastViewedSchoolId');
    this.router.navigate(lastId ? ['/collection', lastId] : ['/collection']);
  }

  canSendSystemInfo(): boolean {
    return this.isDeveloperUser();
  }

  toggleSystemInfoComposer(event: MouseEvent): void {
    event.stopPropagation();
    this.showSystemInfoComposer = !this.showSystemInfoComposer;
  }

  submitSystemInfo(event: MouseEvent): void {
    event.stopPropagation();

    const title = this.systemInfoTitle.trim();
    const message = this.systemInfoMessage.trim();
    const link = this.systemInfoLink.trim();

    if (!title || !message) {
      this.snackBar.open('Titel und Nachricht sind erforderlich.', 'Schließen', { duration: 3200 });
      return;
    }

    if (this.systemInfoScope === 'school' && !this.getLastViewedSchoolId()) {
      this.snackBar.open('Keine zuletzt geöffnete Schule gefunden.', 'Schließen', { duration: 3200 });
      return;
    }

    if (this.isSendingSystemInfo) {
      return;
    }

    this.isSendingSystemInfo = true;

    const request$ = this.systemInfoScope === 'all'
      ? this.service.sendSystemInfoToAll({
        title,
        message,
        link: link || null
      })
      : this.service.sendSystemInfoToSchool(this.getLastViewedSchoolId()!, {
        title,
        message,
        link: link || null
      });

    request$.subscribe({
      next: () => {
        this.snackBar.open('System-Info wurde versendet.', 'OK', { duration: 2400 });
        this.systemInfoTitle = '';
        this.systemInfoMessage = '';
        this.systemInfoLink = '';
        this.systemInfoScope = 'school';
        this.showSystemInfoComposer = false;
      },
      error: (err) => {
        console.error('Fehler beim Senden der System-Info:', err);
        this.snackBar.open(
          this.extractError(err, 'System-Info konnte nicht versendet werden.'),
          'Schließen',
          { duration: 3600 }
        );
      },
      complete: () => {
        this.isSendingSystemInfo = false;
      }
    });
  }

  private getLastViewedSchoolId(): number | null {
    const raw = localStorage.getItem('lastViewedSchoolId');

    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isDeveloperUser(): boolean {
    const username = (this.user as any)?.username?.toLowerCase?.() ?? '';
    return ['michi', 'developer', 'admin'].includes(username);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const nav = document.querySelector('.navbar');
    window.scrollY > 10 ? nav?.classList.add('scrolled') : nav?.classList.remove('scrolled');
  }

  getInitials(): string {
    return this.service.getUserInitials(this.user);
  }

  getAvatarUrl(): string | null {
    return this.service.getAvatarUrl(this.user);
  }

  private extractError(err: any, fallback: string): string {
    return err?.error?.message || err?.error || fallback;
  }

  getLogo(): string {
    const isDark = document.body.classList.contains('dark-mode');
    return isDark ? '/darkmode.png' : '/lightmode.png';
  }
}
