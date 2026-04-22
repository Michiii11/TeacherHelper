import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import { HttpService } from '../../service/http.service';
import { AdminCountPeriodDTO, AdminDashboardDTO, AdminUserDashboardDTO } from '../../model/User';

type AdminSortKey = 'newest' | 'oldest' | 'lastActive' | 'nameAsc' | 'nameDesc';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgClass,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly navbarActions = inject(NavbarActionsService);
  private readonly snack = inject(MatSnackBar);
  private readonly service = inject(HttpService);

  search = '';
  sort: AdminSortKey = 'lastActive';

  dash: AdminDashboardDTO = {
    amountUsers: 0,
    activeUsersMonth: 0,
    activeUsersWeek: 0,
    newUsersMonth: 0,
    freeAbos: 0,
    proAbos: 0,
    schoolAbos: 0,
    cashflow: 0,
    collections: this.emptyPeriod(),
    examples: this.emptyPeriod(),
    tests: this.emptyPeriod(),
    users: []
  };

  ngOnInit(): void {
    this.setNavbar();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  get selectedUser(): AdminUserDashboardDTO | null {
    if (!this.dash.users.length) {
      return null;
    }

    return this.visibleUsers[0] ?? null;
  }

  get visibleUsers(): AdminUserDashboardDTO[] {
    const query = this.search.trim().toLowerCase();

    const filtered = this.dash.users.filter((user) => {
      if (!query) {
        return true;
      }

      return [String(user.id), user.username].some((value) =>
        value.toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => this.compareUsers(a, b));
  }

  loadDashboard(): void {
    this.service.getAdminDashboard().subscribe({
      next: (data: AdminDashboardDTO) => {
        this.dash = {
          ...data,
          users: Array.isArray(data.users) ? data.users : [],
          collections: data.collections ?? this.emptyPeriod(),
          examples: data.examples ?? this.emptyPeriod(),
          tests: data.tests ?? this.emptyPeriod()
        };
      },
      error: () => {
        this.snack.open('Admin Dashboard konnte nicht geladen werden.', 'OK', { duration: 3000 });
      }
    });
  }

  copyUserId(user: AdminUserDashboardDTO, event?: MouseEvent): void {
    event?.stopPropagation();

    navigator.clipboard.writeText(String(user.id)).then(() => {
      this.snack.open(`User-ID ${user.id} kopiert`, 'OK', { duration: 2200 });
    }).catch(() => {
      this.snack.open('Konnte User-ID nicht kopieren', 'OK', { duration: 2200 });
    });
  }

  getLastActiveLabel(value: string): string {
    if (!value) {
      return 'Unbekannt';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Unbekannt';
    }

    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `vor ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `vor ${diffDays} Tagen`;

    const diffMonths = Math.floor(diffDays / 30);
    return `vor ${diffMonths} Monaten`;
  }

  trackByUserId(_: number, user: AdminUserDashboardDTO): string {
    return user.id;
  }

  private setNavbar(): void {
    this.navbarActions.setBreadcrumbs([
      { label: 'Admin Dashboard', route: ['/admin'] }
    ] as any);

    this.navbarActions.setActions([]);
  }

  private compareUsers(a: AdminUserDashboardDTO, b: AdminUserDashboardDTO): number {
    switch (this.sort) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'nameAsc':
        return a.username.localeCompare(b.username);
      case 'nameDesc':
        return b.username.localeCompare(a.username);
      case 'lastActive':
      default:
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
    }
  }

  private emptyPeriod(): AdminCountPeriodDTO {
    return {
      hour: 0,
      day: 0,
      week: 0,
      month: 0,
      year: 0
    };
  }
}
