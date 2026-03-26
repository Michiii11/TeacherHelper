import { Component, HostListener, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { MatToolbar } from '@angular/material/toolbar';
import { MatAnchor, MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { HttpService } from '../../service/http.service';
import { User } from '../../model/User';
import { NotificationDTO, NotificationActionType, NotificationType } from '../../model/Notification';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    DatePipe,
    NgClass,
    MatToolbar,
    MatAnchor,
    MatIcon,
    MatIconButton,
    MatMenuItem,
    MatMenu,
    MatMenuTrigger,
    MatDivider,
    MatButton,
    MatSnackBarModule,
    MatTooltip
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent implements OnInit {
  service = inject(HttpService);
  snackBar = inject(MatSnackBar);

  user: User = {} as User;
  notifications: NotificationDTO[] = [];
  selectedTab: 'open' | 'history' = 'open';
  processingIds = new Set<number>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUser();
    this.loadNotifications();
  }

  private loadUser(): void {
    this.service.getUser().subscribe({
      next: (user) => (this.user = user),
      error: (err) => console.error(err)
    });
  }

  loadNotifications(): void {
    this.service.getMyNotifications().subscribe({
      next: (n) => {
        this.notifications = (n ?? []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },
      error: (err) => console.error(err)
    });
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read && !this.isHandled(n)).length;
  }

  get openNotifications(): NotificationDTO[] {
    return this.notifications.filter((n) => !this.isHandled(n) && !n.archived);
  }

  get historyNotifications(): NotificationDTO[] {
    return this.notifications.filter((n) => this.isHandled(n) && !n.archived);
  }

  setTab(tab: 'open' | 'history', event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedTab = tab;
  }

  visibleNotifications(): NotificationDTO[] {
    return this.selectedTab === 'open' ? this.openNotifications : this.historyNotifications;
  }

  isHandled(n: NotificationDTO): boolean {
    if (n.archived || this.isResultNotification(n)) {
      return true;
    }

    if (this.hasDecisionActions(n) && n.relatedEntityId != null) {
      return this.notifications.some(
        (candidate) =>
          candidate.relatedEntityId === n.relatedEntityId && this.isResultNotification(candidate)
      );
    }

    return false;
  }

  isResultNotification(n: NotificationDTO): boolean {
    return [
      NotificationType.JOIN_REQUEST_ACCEPTED,
      NotificationType.JOIN_REQUEST_DECLINED,
      NotificationType.INVITATION_ACCEPTED,
      NotificationType.INVITATION_DECLINED
    ].includes(n.type);
  }

  hasDecisionActions(n: NotificationDTO): boolean {
    return [
        NotificationActionType.ACCEPT_INVITATION,
        NotificationActionType.DECLINE_INVITATION,
        NotificationActionType.ACCEPT_JOIN_REQUEST,
        NotificationActionType.DECLINE_JOIN_REQUEST
      ].includes(n.primaryAction as NotificationActionType)
      || [
        NotificationActionType.ACCEPT_INVITATION,
        NotificationActionType.DECLINE_INVITATION,
        NotificationActionType.ACCEPT_JOIN_REQUEST,
        NotificationActionType.DECLINE_JOIN_REQUEST
      ].includes(n.secondaryAction as NotificationActionType);
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

  onNotificationClick(n: NotificationDTO): void {
    if (this.hasDecisionActions(n)) {
      return;
    }

    if (!n.read) {
      this.service.markAsRead(n.id).subscribe({
        next: () => (n.read = true),
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
            this.selectedTab = 'history';
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
            this.selectedTab = 'history';
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

      case NotificationActionType.ACCEPT_JOIN_REQUEST:
        this.service.respondToJoinRequest(n.relatedEntityId!, true).subscribe({
          next: () => {
            this.snackBar.open('Anfrage bestätigt.', 'OK', { duration: 2200 });
            this.loadNotifications();
            this.selectedTab = 'history';
          },
          error: (err) => {
            console.error('Fehler beim Annehmen der Beitrittsanfrage:', err);
            this.snackBar.open(this.extractError(err, 'Anfrage konnte nicht bestätigt werden.'), 'Schließen', {
              duration: 3600
            });
          },
          complete: () => this.processingIds.delete(n.id)
        });
        break;

      case NotificationActionType.DECLINE_JOIN_REQUEST:
        this.service.respondToJoinRequest(n.relatedEntityId!, false).subscribe({
          next: () => {
            this.snackBar.open('Anfrage abgelehnt.', 'OK', { duration: 2200 });
            this.loadNotifications();
            this.selectedTab = 'history';
          },
          error: (err) => {
            console.error('Fehler beim Ablehnen der Beitrittsanfrage:', err);
            this.snackBar.open(this.extractError(err, 'Anfrage konnte nicht abgelehnt werden.'), 'Schließen', {
              duration: 3600
            });
          },
          complete: () => this.processingIds.delete(n.id)
        });
        break;

      default:
        this.service.executeAction(n.id, action).subscribe({
          next: () => this.loadNotifications(),
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
      NotificationActionType.DECLINE_INVITATION,
      NotificationActionType.ACCEPT_JOIN_REQUEST,
      NotificationActionType.DECLINE_JOIN_REQUEST
    ].includes(action);
  }

  isProcessing(n: NotificationDTO): boolean {
    return this.processingIds.has(n.id);
  }

  getActionLabel(action?: NotificationActionType): string {
    switch (action) {
      case NotificationActionType.ACCEPT_INVITATION:
      case NotificationActionType.ACCEPT_JOIN_REQUEST:
        return 'Bestätigen';
      case NotificationActionType.DECLINE_INVITATION:
      case NotificationActionType.DECLINE_JOIN_REQUEST:
        return 'Ablehnen';
      case NotificationActionType.OPEN_LINK:
        return 'Öffnen';
      case NotificationActionType.MARK_AS_READ:
        return 'Gelesen';
      case NotificationActionType.ARCHIVE:
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
      case NotificationType.JOIN_REQUEST_ACCEPTED:
      case NotificationType.INVITATION_ACCEPTED:
        return 'Bestätigt';
      case NotificationType.JOIN_REQUEST_DECLINED:
      case NotificationType.INVITATION_DECLINED:
        return 'Abgelehnt';
      case NotificationType.SCHOOL_NEWS:
        return 'News';
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
      case NotificationType.JOIN_REQUEST_ACCEPTED:
      case NotificationType.INVITATION_ACCEPTED:
        return 'check_circle';
      case NotificationType.JOIN_REQUEST_DECLINED:
      case NotificationType.INVITATION_DECLINED:
        return 'cancel';
      case NotificationType.SCHOOL_NEWS:
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
    this.router.navigate(lastId ? ['/school', lastId] : ['/school']);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const nav = document.querySelector('.navbar');
    window.scrollY > 10 ? nav?.classList.add('scrolled') : nav?.classList.remove('scrolled');
  }

  getInitials(): string {
    if (!this.user?.username) return '?';
    return this.user.username
      .split(' ')
      .filter((p) => p.trim().length > 0)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  private extractError(err: any, fallback: string): string {
    return err?.error?.message || err?.error || fallback;
  }
}
