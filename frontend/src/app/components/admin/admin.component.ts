import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import { HttpService } from '../../service/http.service';
import { AdminCountPeriodDTO, AdminDashboardDTO, AdminUserDashboardDTO } from '../../model/User';
import {SchoolDTO} from '../../model/School'

type AdminSortKey = 'newest' | 'oldest' | 'lastActive' | 'nameAsc' | 'nameDesc';
type AdminDashboardKey = keyof Pick<
  AdminDashboardDTO,
  | 'amountUsers'
  | 'activeUsersMonth'
  | 'activeUsersWeek'
  | 'newUsersMonth'
  | 'freeAbos'
  | 'proAbos'
  | 'schoolAbos'
  | 'cashflow'
>;
type AdminPeriodKey = keyof Pick<AdminDashboardDTO, 'collections' | 'examples' | 'tests'>;
type AdminUserMetricKey = keyof Pick<AdminUserDashboardDTO, 'collections' | 'examples' | 'tests'>;

interface StatCardConfig {
  label: string;
  key: AdminDashboardKey;
  toneClass: string;
}

interface MetricPanelConfig {
  label: string;
  icon: string;
  key: AdminPeriodKey;
}

interface PeriodConfig {
  label: string;
  key: keyof AdminCountPeriodDTO;
}

interface SortOption {
  label: string;
  value: AdminSortKey;
}

interface UserMetricConfig {
  label: string;
  key: AdminUserMetricKey;
}

interface AdminCollectionOverviewDTO {
  id?: string;
  name?: string;
  title?: string;
  members?: unknown[] | number;
  memberCount?: number;
  users?: unknown[] | number;
  userCount?: number;
  examples?: unknown[] | number;
  exampleCount?: number;
  tests?: unknown[] | number;
  testCount?: number;
}

type AdminUserWithCollections = AdminUserDashboardDTO & {
  collectionList?: AdminCollectionOverviewDTO[];
  collectionOverviews?: AdminCollectionOverviewDTO[];
  collectionsOverview?: AdminCollectionOverviewDTO[];
  ownedCollections?: AdminCollectionOverviewDTO[];
};

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

  readonly userStatCards: StatCardConfig[] = [
    { label: 'User gesamt', key: 'amountUsers', toneClass: 'tone-users' },
    { label: 'Aktiv im Monat', key: 'activeUsersMonth', toneClass: 'tone-active-month' },
    { label: 'Aktiv in der Woche', key: 'activeUsersWeek', toneClass: 'tone-active-week' },
    { label: 'Neue User im Monat', key: 'newUsersMonth', toneClass: 'tone-new-users' }
  ];

  readonly aboStatCards: StatCardConfig[] = [
    { label: 'Free Abos', key: 'freeAbos', toneClass: 'tone-free' },
    { label: 'Pro Abos', key: 'proAbos', toneClass: 'tone-pro' },
    { label: 'School Abos', key: 'schoolAbos', toneClass: 'tone-school' },
    { label: 'Geschätzter Umsatz / Monat', key: 'cashflow', toneClass: 'tone-revenue' }
  ];

  readonly metricPanels: MetricPanelConfig[] = [
    { label: 'Collections', icon: 'folder', key: 'collections' },
    { label: 'Examples', icon: 'post_add', key: 'examples' },
    { label: 'Tests', icon: 'assignment', key: 'tests' }
  ];

  readonly periods: PeriodConfig[] = [
    { label: 'Stunde', key: 'hour' },
    { label: 'Tag', key: 'day' },
    { label: 'Woche', key: 'week' },
    { label: 'Monat', key: 'month' },
    { label: 'Jahr', key: 'year' }
  ];

  readonly sortOptions: SortOption[] = [
    { value: 'lastActive', label: 'Zuletzt aktiv' },
    { value: 'newest', label: 'Neueste zuerst' },
    { value: 'oldest', label: 'Älteste zuerst' },
    { value: 'nameAsc', label: 'Name A–Z' },
    { value: 'nameDesc', label: 'Name Z–A' }
  ];

  readonly userMetrics: UserMetricConfig[] = [
    { label: 'Collections', key: 'collections' },
    { label: 'Examples', key: 'examples' },
    { label: 'Tests', key: 'tests' }
  ];

  search = '';
  sort: AdminSortKey = 'lastActive';
  selectedUserId: string | null = null;
  selectedUserDTO: { id: string; schools: SchoolDTO[] } = { id: '', schools: [] };
  dash: AdminDashboardDTO = this.createEmptyDashboard();

  ngOnInit(): void {
    this.setNavbar();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  get visibleUsers(): AdminUserDashboardDTO[] {
    const query = this.normalizedSearch;

    return this.dash.users
      .filter((user) => this.matchesUserSearch(user, query))
      .sort((a, b) => this.compareUsers(a, b));
  }

  get selectedUser(): AdminUserDashboardDTO | null {
    if (!this.selectedUserId) {
      return null;
    }

    return this.dash.users.find((user) => user.id === this.selectedUserId) ?? null;
  }

  loadDashboard(): void {
    this.service.getAdminDashboard().subscribe({
      next: (data) => {
        this.dash = this.normalizeDashboard(data);

        if (this.selectedUserId && !this.dash.users.some((user) => user.id === this.selectedUserId)) {
          this.selectedUserId = null;
        }
      },
      error: () => this.showMessage('Admin Dashboard konnte nicht geladen werden.', 3000)
    });
  }

  selectUser(user: AdminUserDashboardDTO): void {
    this.selectedUserId = user.id;

    this.service.getUserAdminDashboard(user.id).subscribe({
      next: (data) => {
        this.selectedUserDTO = data as { id: string; schools: SchoolDTO[] }
        console.log(this.selectedUserDTO)
      }
    })
  }

  copyUserId(user: AdminUserDashboardDTO, event?: MouseEvent): void {
    event?.stopPropagation();

    navigator.clipboard.writeText(String(user.id))
      .then(() => this.showMessage(`User-ID ${user.id} kopiert`))
      .catch(() => this.showMessage('Konnte User-ID nicht kopieren'));
  }

  getPeriodValue(period: AdminPeriodKey, key: keyof AdminCountPeriodDTO): number {
    return this.dash[period]?.[key] ?? 0;
  }

  getStatValue(key: AdminDashboardKey): number {
    return Number(this.dash[key] ?? 0);
  }

  getUserMetricValue(user: AdminUserDashboardDTO, key: AdminUserMetricKey): number {
    return Number(user[key] ?? 0);
  }

  getUserInitials(username: string): string {
    const normalized = username?.trim();
    return normalized ? normalized.slice(0, 2).toUpperCase() : '--';
  }

  getLastActiveLabel(value: string): string {
    const date = this.parseDate(value);

    if (!date) {
      return 'Unbekannt';
    }

    const diffHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));

    if (diffHours < 1) {
      return 'Gerade eben';
    }

    if (diffHours < 24) {
      return `vor ${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 30) {
      return `vor ${diffDays} Tagen`;
    }

    return `vor ${Math.floor(diffDays / 30)} Monaten`;
  }

  getUserCollections(user: AdminUserDashboardDTO | null): AdminCollectionOverviewDTO[] {
    if (!user) {
      return [];
    }

    const userWithCollections = user as AdminUserWithCollections;
    const possibleCollections = [
      userWithCollections.collectionList,
      userWithCollections.collectionOverviews,
      userWithCollections.collectionsOverview,
      userWithCollections.ownedCollections,
      (userWithCollections as any).collections
    ];

    return possibleCollections.find(Array.isArray) ?? [];
  }

  getCollectionName(collection: AdminCollectionOverviewDTO): string {
    return collection.name || collection.title || 'Unbenannte Collection';
  }

  getCollectionMemberCount(collection: AdminCollectionOverviewDTO): number {
    return this.readCount(collection.members, collection.memberCount, collection.users, collection.userCount);
  }

  getCollectionExampleCount(collection: AdminCollectionOverviewDTO): number {
    return this.readCount(collection.examples, collection.exampleCount);
  }

  getCollectionTestCount(collection: AdminCollectionOverviewDTO): number {
    return this.readCount(collection.tests, collection.testCount);
  }

  trackByUserId(_: number, user: AdminUserDashboardDTO): string {
    return user.id;
  }

  trackByCollection(index: number, collection: AdminCollectionOverviewDTO): string {
    return collection.id ?? `${this.getCollectionName(collection)}-${index}`;
  }

  private get normalizedSearch(): string {
    return this.search.trim().toLowerCase();
  }

  private setNavbar(): void {
    this.navbarActions.setBreadcrumbs([
      { label: 'Admin Dashboard', route: ['/admin'] }
    ] as any);

    this.navbarActions.setActions([]);
  }

  private matchesUserSearch(user: AdminUserDashboardDTO, query: string): boolean {
    if (!query) {
      return true;
    }

    return [user.id, user.username]
      .map((value) => String(value).toLowerCase())
      .some((value) => value.includes(query));
  }

  private compareUsers(a: AdminUserDashboardDTO, b: AdminUserDashboardDTO): number {
    switch (this.sort) {
      case 'newest':
        return this.dateTime(b.createdAt) - this.dateTime(a.createdAt);
      case 'oldest':
        return this.dateTime(a.createdAt) - this.dateTime(b.createdAt);
      case 'nameAsc':
        return a.username.localeCompare(b.username);
      case 'nameDesc':
        return b.username.localeCompare(a.username);
      case 'lastActive':
      default:
        return this.dateTime(b.lastActive) - this.dateTime(a.lastActive);
    }
  }

  private normalizeDashboard(data: AdminDashboardDTO): AdminDashboardDTO {
    return {
      ...this.createEmptyDashboard(),
      ...data,
      users: Array.isArray(data.users) ? data.users : [],
      collections: data.collections ?? this.emptyPeriod(),
      examples: data.examples ?? this.emptyPeriod(),
      tests: data.tests ?? this.emptyPeriod()
    };
  }

  private createEmptyDashboard(): AdminDashboardDTO {
    return {
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

  private readCount(...values: Array<unknown[] | number | undefined>): number {
    for (const value of values) {
      if (Array.isArray(value)) {
        return value.length;
      }

      if (typeof value === 'number') {
        return value;
      }
    }

    return 0;
  }

  private dateTime(value: string): number {
    return this.parseDate(value)?.getTime() ?? 0;
  }

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private showMessage(message: string, duration = 2200): void {
    this.snack.open(message, 'OK', { duration });
  }
}
