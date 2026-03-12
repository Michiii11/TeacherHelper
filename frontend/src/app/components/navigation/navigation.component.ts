import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { MatAnchor, MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { HttpService } from '../../service/http.service';
import { User } from '../../model/User';
import { JoinRequestDTO, RequestType } from '../../model/School';

type RequestUiStatus = 'accepted' | 'declined' | undefined;

type JoinRequestViewModel = JoinRequestDTO & {
  _processing?: boolean;
  _status?: RequestUiStatus;
};

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbar,
    MatAnchor,
    MatIcon,
    MatIconButton,
    MatMenuItem,
    MatMenu,
    MatMenuTrigger,
    MatDivider,
    MatButton,
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent {
  service = inject(HttpService);

  user: User = {} as User;
  requests: JoinRequestViewModel[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUser();
    this.loadRequests();
  }

  private loadUser(): void {
    this.service.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: (error) => {
        console.error('Fehler beim Laden des Users:', error);
      }
    });
  }

  private loadRequests(): void {
    this.service.getJoinRequests(0).subscribe({
      next: (requests: JoinRequestDTO[]) => {
        this.requests = (requests ?? []).map(request => ({
          ...request,
          _processing: false,
          _status: undefined
        }));
      },
      error: (error) => {
        console.error('Fehler beim Laden der Requests:', error);
        this.requests = [];
      }
    });
  }

  get openRequests(): JoinRequestViewModel[] {
    return this.requests.filter(request => !request.done);
  }

  goToSchool(): void {
    const lastId = localStorage.getItem('lastViewedSchoolId');

    if (lastId) {
      this.router.navigate(['/school', lastId]);
      return;
    }

    this.router.navigate(['/school']);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const nav = document.querySelector('.navbar');

    if (window.scrollY > 10) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
  }

  toggleMenu(): void {
    // aktuell nicht verwendet
  }

  getInitials(): string {
    if (!this.user?.username) {
      return '?';
    }

    return this.user.username
      .split(' ')
      .filter(part => part.trim().length > 0)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  getRequestInitial(request: JoinRequestViewModel): string {
    const name = request.transmitter?.username?.trim();

    if (!name) {
      return '?';
    }

    return name.charAt(0).toUpperCase();
  }

  getRequestTitle(request: JoinRequestViewModel): string {
    return request.transmitter?.username || 'Unbekannt';
  }

  getRequestText(request: JoinRequestViewModel): string {
    const schoolName = request.school?.name || 'Unbekannte Schule';

    if (request.type === RequestType.INVITE) {
      return `hat Sie zur Schule ${schoolName} eingeladen.`;
    }

    return `möchte der Schule ${schoolName} beitreten.`;
  }

  getRequestCategoryLabel(request: JoinRequestViewModel): string {
    return request.type === RequestType.INVITE ? 'Einladung' : 'Beitrittsanfrage';
  }

  onNotificationAction(event: Event, request: JoinRequestViewModel, accept: boolean): void {
    event.preventDefault();
    event.stopPropagation();

    if (accept) {
      this.acceptRequest(request);
      return;
    }

    this.declineRequest(request);
  }

  acceptRequest(request: JoinRequestViewModel): void {
    if (request._processing || request.done) {
      return;
    }

    request._processing = true;

    this.service.acceptRequest(request.id).subscribe({
      next: () => {
        request._processing = false;
        request._status = 'accepted';
        request.accepted = true;
        request.done = true;
        this.requests = this.requests.filter(r => r !== request);
      },
      error: (error) => {
        request._processing = false;
        console.error('Fehler beim Akzeptieren der Anfrage:', error);
      }
    });
  }

  declineRequest(request: JoinRequestViewModel): void {
    if (request._processing || request.done) {
      return;
    }

    request._processing = true;

    this.service.declineRequest(request.id).subscribe({
      next: () => {
        request._processing = false;
        request._status = 'declined';
        request.accepted = false;
        request.done = true;
        this.requests = this.requests.filter(r => r !== request);
      },
      error: (error) => {
        request._processing = false;
        console.error('Fehler beim Ablehnen der Anfrage:', error);
      }
    });
  }

  protected readonly RequestType = RequestType;
}
