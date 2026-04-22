import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavbarActionsService } from '../navigation/navbar-actions.service';

interface AdminMetricBucket {
  label: string;
  value: number;
}

interface AdminActivityMetrics {
  hour: number;
  day: number;
  week: number;
  month: number;
  year: number;
}

interface AdminOwnedItem {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

type AdminTier = 'FREE' | 'PLUS' | 'PRO' | 'SCHOOL' | 'ENTERPRISE';
type AdminSortKey = 'newest' | 'oldest' | 'lastActive' | 'nameAsc' | 'nameDesc';

interface AdminUserViewModel {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
  isDisabled: boolean;
  tier: AdminTier;
  tierExpiresAt: string | null;
  collectionsCount: number;
  examplesCount: number;
  testsCount: number;
  collections: AdminOwnedItem[];
  examples: AdminOwnedItem[];
  tests: AdminOwnedItem[];
}

interface AdminDashboardState {
  users: AdminUserViewModel[];
  metrics: {
    collections: AdminActivityMetrics;
    examples: AdminActivityMetrics;
    tests: AdminActivityMetrics;
  };
}

interface StagedUserPatch {
  id: number;
  isDisabled?: boolean;
  tier?: AdminTier;
  tierExpiresAt?: string | null;
}

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

  protected readonly tierOptions: AdminTier[] = ['FREE', 'PLUS', 'PRO', 'SCHOOL', 'ENTERPRISE'];
  protected readonly activityWindows: Array<{ key: keyof AdminActivityMetrics; label: string }> = [
    { key: 'hour', label: 'Stunde' },
    { key: 'day', label: 'Tag' },
    { key: 'week', label: 'Woche' },
    { key: 'month', label: 'Monat' },
    { key: 'year', label: 'Jahr' }
  ];

  users: AdminUserViewModel[] = [];
  selectedUserId: number | null = null;
  search = '';
  sort: AdminSortKey = 'lastActive';
  stagedChanges = new Map<number, StagedUserPatch>();
  saving = false;

  ngOnInit(): void {
    this.setNavbar();
    this.loadLocalDashboard();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  get selectedUser(): AdminUserViewModel | null {
    if (this.selectedUserId == null) return null;
    return this.users.find(user => user.id === this.selectedUserId) ?? null;
  }

  get pendingChangeCount(): number {
    return this.stagedChanges.size;
  }

  get activeUsersCount(): number {
    return this.users.filter(user => user.isActive && !user.isDisabled).length;
  }

  get disabledUsersCount(): number {
    return this.users.filter(user => user.isDisabled).length;
  }

  get newUsersThisMonth(): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    return this.users.filter(user => new Date(user.createdAt) >= cutoff).length;
  }

  get dashboardMetrics(): AdminDashboardState['metrics'] {
    return {
      collections: this.sumMetrics('collections'),
      examples: this.sumMetrics('examples'),
      tests: this.sumMetrics('tests')
    };
  }

  get visibleUsers(): AdminUserViewModel[] {
    const query = this.search.trim().toLowerCase();

    const filtered = this.users.filter(user => {
      if (!query) return true;

      return [
        String(user.id),
        user.username,
        user.email,
        user.tier
      ].some(value => value.toLowerCase().includes(query));
    });

    return filtered.sort((a, b) => this.compareUsers(a, b));
  }

  selectUser(user: AdminUserViewModel): void {
    this.selectedUserId = user.id;
  }

  moveUser(user: AdminUserViewModel, direction: -1 | 1): void {
    const currentIndex = this.visibleUsers.findIndex(item => item.id === user.id);
    const visible = this.visibleUsers;
    const swapIndex = currentIndex + direction;

    if (currentIndex < 0 || swapIndex < 0 || swapIndex >= visible.length) {
      return;
    }

    const allIndexA = this.users.findIndex(item => item.id === visible[currentIndex].id);
    const allIndexB = this.users.findIndex(item => item.id === visible[swapIndex].id);

    if (allIndexA < 0 || allIndexB < 0) {
      return;
    }

    [this.users[allIndexA], this.users[allIndexB]] = [this.users[allIndexB], this.users[allIndexA]];
  }

  copyUserId(user: AdminUserViewModel): void {
    navigator.clipboard.writeText(String(user.id)).then(() => {
      this.snack.open(`User-ID ${user.id} kopiert`, 'OK', { duration: 2200 });
    }).catch(() => {
      this.snack.open('Konnte User-ID nicht kopieren', 'OK', { duration: 2200 });
    });
  }

  toggleDisabled(user: AdminUserViewModel): void {
    user.isDisabled = !user.isDisabled;
    if (user.isDisabled) {
      user.isActive = false;
    }

    this.stageUserPatch(user.id, { isDisabled: user.isDisabled });
  }

  changeTier(user: AdminUserViewModel, tier: AdminTier): void {
    user.tier = tier;
    this.stageUserPatch(user.id, { tier });
  }

  changeTierExpiry(user: AdminUserViewModel, value: string): void {
    user.tierExpiresAt = value ? new Date(`${value}T23:59:59`).toISOString() : null;
    this.stageUserPatch(user.id, { tierExpiresAt: user.tierExpiresAt });
  }

  hasPendingChanges(userId: number): boolean {
    return this.stagedChanges.has(userId);
  }

  discardAllChanges(): void {
    this.stagedChanges.clear();
    this.loadLocalDashboard();
    this.snack.open('Lokale Änderungen verworfen', 'OK', { duration: 2200 });
  }

  saveAllChanges(): void {
    if (!this.pendingChangeCount || this.saving) {
      return;
    }

    this.saving = true;

    // TODO: Hier später echten Admin-Endpoint aufrufen.
    // Beispiel:
    // this.http.updateAdminUsers(Array.from(this.stagedChanges.values())).subscribe(...)
    setTimeout(() => {
      this.saving = false;
      this.stagedChanges.clear();
      this.snack.open('Änderungen lokal bestätigt – hier später an Server senden', 'OK', { duration: 2600 });
    }, 600);
  }

  getLastActiveLabel(value: string): string {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `vor ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `vor ${diffDays} Tagen`;

    const diffMonths = Math.floor(diffDays / 30);
    return `vor ${diffMonths} Monaten`;
  }

  getTierExpiryInputValue(value: string | null): string {
    if (!value) return '';
    return new Date(value).toISOString().slice(0, 10);
  }

  trackByUserId(_: number, user: AdminUserViewModel): number {
    return user.id;
  }

  trackByItemId(_: number, item: AdminOwnedItem): number {
    return item.id;
  }

  private setNavbar(): void {
    this.navbarActions.setBreadcrumbs([
      { label: 'Admin Dashboard', route: ['/admin'] }
    ] as any);

    this.navbarActions.setActions([
      {
        label: 'Verwerfen',
        icon: 'restore',
        variant: 'stroked',
        action: () => this.discardAllChanges(),
        disabled: this.pendingChangeCount === 0
      },
      {
        label: 'Speichern',
        icon: 'save',
        variant: 'flat',
        action: () => this.saveAllChanges(),
        disabled: this.pendingChangeCount === 0
      }
    ]);
  }

  private refreshNavbarActions(): void {
    this.setNavbar();
  }

  private stageUserPatch(userId: number, patch: Partial<StagedUserPatch>): void {
    const previous = this.stagedChanges.get(userId) ?? { id: userId };
    this.stagedChanges.set(userId, { ...previous, ...patch, id: userId });
    this.refreshNavbarActions();
  }

  private compareUsers(a: AdminUserViewModel, b: AdminUserViewModel): number {
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
        return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    }
  }

  private sumMetrics(key: 'collections' | 'examples' | 'tests'): AdminActivityMetrics {
    return this.users.reduce<AdminActivityMetrics>((acc, user) => {
      const total = key === 'collections'
        ? user.collectionsCount
        : key === 'examples'
          ? user.examplesCount
          : user.testsCount;

      acc.hour += Math.min(total, user.id % 3);
      acc.day += Math.min(total, Math.max(1, user.id % 5));
      acc.week += Math.min(total, Math.max(2, user.id % 8));
      acc.month += Math.min(total, Math.max(3, user.id % 12));
      acc.year += total;
      return acc;
    }, { hour: 0, day: 0, week: 0, month: 0, year: 0 });
  }

  private loadLocalDashboard(): void {
    this.users = this.buildMockUsers();
    this.selectedUserId = this.users[0]?.id ?? null;
    this.refreshNavbarActions();
  }

  private buildMockUsers(): AdminUserViewModel[] {
    return [
      this.createMockUser(1, 'michi', 'michi@teacher-helper.app', 'ENTERPRISE', false, true, 14, 77, 12),
      this.createMockUser(2, 'anna.huber', 'anna@schule.at', 'SCHOOL', false, true, 6, 31, 4),
      this.createMockUser(3, 'lukas.dev', 'lukas@demo.at', 'PRO', false, true, 9, 54, 8),
      this.createMockUser(4, 'sarah.free', 'sarah@gmail.com', 'FREE', false, true, 2, 9, 1),
      this.createMockUser(5, 'max.plus', 'max@demo.at', 'PLUS', true, false, 4, 18, 2),
      this.createMockUser(6, 'eva.teacher', 'eva@htl.at', 'SCHOOL', false, true, 11, 42, 6)
    ];
  }

  private createMockUser(
    id: number,
    username: string,
    email: string,
    tier: AdminTier,
    isDisabled: boolean,
    isActive: boolean,
    collectionsCount: number,
    examplesCount: number,
    testsCount: number
  ): AdminUserViewModel {
    const now = Date.now();
    const createdAt = new Date(now - id * 18 * 24 * 60 * 60 * 1000).toISOString();
    const lastActiveAt = new Date(now - id * 7 * 60 * 60 * 1000).toISOString();

    return {
      id,
      username,
      email,
      createdAt,
      lastActiveAt,
      isActive,
      isDisabled,
      tier,
      tierExpiresAt: tier === 'FREE' ? null : new Date(now + id * 20 * 24 * 60 * 60 * 1000).toISOString(),
      collectionsCount,
      examplesCount,
      testsCount,
      collections: this.createOwnedItems(id, 'Sammlung', collectionsCount),
      examples: this.createOwnedItems(id, 'Example', examplesCount),
      tests: this.createOwnedItems(id, 'Test', testsCount)
    };
  }

  private createOwnedItems(userId: number, prefix: string, count: number): AdminOwnedItem[] {
    return Array.from({ length: count }).map((_, index) => ({
      id: userId * 1000 + index + 1,
      title: `${prefix} ${index + 1}`,
      createdAt: new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - (index + 1) * 8 * 60 * 60 * 1000).toISOString()
    }));
  }
}
