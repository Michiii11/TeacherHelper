import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { NavbarActionsService } from "../navigation/navbar-actions.service";
import { HttpService } from "../../service/http.service";
import {
  AdminCountPeriodDTO,
  AdminDashboardDTO,
  AdminUserDashboardDTO,
  UserDTO,
} from "../../model/User";
import { CollectionDTO } from "../../model/Collection";
import { ExampleOverviewDTO } from "../../model/Example";
import { TestOverviewDTO } from "../../model/Test";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import {TranslatePipe} from '@ngx-translate/core'

type AdminSortKey = "newest" | "oldest" | "lastActive" | "nameAsc" | "nameDesc";
type CollectionSortKey =
  | "nameAsc"
  | "nameDesc"
  | "membersDesc"
  | "examplesDesc"
  | "testsDesc";
type AdminDashboardKey = keyof Pick<
  AdminDashboardDTO,
  | "amountUsers"
  | "activeUsersMonth"
  | "activeUsersWeek"
  | "newUsersMonth"
  | "freeAbos"
  | "proAbos"
  | "schoolAbos"
  | "cashflow"
>;
type AdminPeriodKey = keyof Pick<
  AdminDashboardDTO,
  "collections" | "examples" | "tests"
>;
type AdminUserMetricKey = keyof Pick<
  AdminUserDashboardDTO,
  "collections" | "examples" | "tests"
>;

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

interface CollectionSortOption {
  label: string;
  value: CollectionSortKey;
}

interface UserMetricConfig {
  label: string;
  key: AdminUserMetricKey;
}

interface AdminUserDetailDTO {
  id: string;
  collections: CollectionDTO[];
}

interface AvatarUser {
  id: string;
  profileImageUrl?: string | null;
}

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: "./admin.component.html",
  styleUrl: "./admin.component.scss",
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly navbarActions = inject(NavbarActionsService);
  private readonly snack = inject(MatSnackBar);
  private readonly service = inject(HttpService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  private avatarUrls = new Map<string, string>();
  private loadingAvatarIds = new Set<string>();

  readonly userStatCards: StatCardConfig[] = [
    { label: "User gesamt", key: "amountUsers", toneClass: "tone-users" },
    { label: "Aktiv im Monat", key: "activeUsersMonth", toneClass: "tone-active-month" },
    { label: "Aktiv in der Woche", key: "activeUsersWeek", toneClass: "tone-active-week" },
    { label: "Neue User im Monat", key: "newUsersMonth", toneClass: "tone-new-users" },
  ];

  readonly aboStatCards: StatCardConfig[] = [
    { label: "Free Abos", key: "freeAbos", toneClass: "tone-free" },
    { label: "Pro Abos", key: "proAbos", toneClass: "tone-pro" },
    { label: "Collection Abos", key: "schoolAbos", toneClass: "tone-collection" },
    { label: "Geschätzter Umsatz / Monat", key: "cashflow", toneClass: "tone-revenue" },
  ];

  readonly metricPanels: MetricPanelConfig[] = [
    { label: "Collections", icon: "folder", key: "collections" },
    { label: "Examples", icon: "post_add", key: "examples" },
    { label: "Tests", icon: "assignment", key: "tests" },
  ];

  readonly periods: PeriodConfig[] = [
    { label: "Stunde", key: "hour" },
    { label: "Tag", key: "day" },
    { label: "Woche", key: "week" },
    { label: "Monat", key: "month" },
    { label: "Jahr", key: "year" },
  ];

  readonly sortOptions: SortOption[] = [
    { value: "lastActive", label: "Zuletzt aktiv" },
    { value: "newest", label: "Neueste zuerst" },
    { value: "oldest", label: "Älteste zuerst" },
    { value: "nameAsc", label: "Name A–Z" },
    { value: "nameDesc", label: "Name Z–A" },
  ];

  readonly userMetrics: UserMetricConfig[] = [
    { label: "Collections", key: "collections" },
    { label: "Examples", key: "examples" },
    { label: "Tests", key: "tests" },
  ];

  readonly collectionSortOptions: CollectionSortOption[] = [
    { value: "nameAsc", label: "Name A–Z" },
    { value: "nameDesc", label: "Name Z–A" },
    { value: "membersDesc", label: "Meiste Mitglieder" },
    { value: "examplesDesc", label: "Meiste Beispiele" },
    { value: "testsDesc", label: "Meiste Tests" },
  ];

  search = "";
  sort: AdminSortKey = "lastActive";
  collectionSearch = "";
  collectionSort: CollectionSortKey = "nameAsc";
  selectedUserId: string | null = null;
  expandedCollectionId: string | null = null;
  selectedUserDTO: AdminUserDetailDTO = { id: "", collections: [] };
  dash: AdminDashboardDTO = this.createEmptyDashboard();
  isDashboardLoading = false;
  isUserLoading = false;

  ngOnInit(): void {
    this.setNavbar();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
    this.revokeAvatarUrls();
    this.destroy$.next();
    this.destroy$.complete();
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

  get visibleCollections(): CollectionDTO[] {
    const query = this.normalizedCollectionSearch;

    return [...this.selectedUserDTO.collections]
      .filter((collection) => this.matchesCollectionSearch(collection, query))
      .sort((a, b) => this.compareCollections(a, b));
  }

  loadDashboard(): void {
    this.isDashboardLoading = true;

    this.service.getAdminDashboard().subscribe({
      next: (data) => {
        this.dash = this.normalizeDashboard(data);
        this.loadDashboardAvatars();

        if (
          this.selectedUserId &&
          !this.dash.users.some((user) => user.id === this.selectedUserId)
        ) {
          this.selectedUserId = null;
          this.expandedCollectionId = null;
          this.selectedUserDTO = { id: "", collections: [] };
        }
      },
      error: () => {
        this.isDashboardLoading = false;
        this.showMessage("Admin Dashboard konnte nicht geladen werden.", 3000);
      },
      complete: () => (this.isDashboardLoading = false),
    });
  }

  selectUser(user: AdminUserDashboardDTO): void {
    this.selectedUserId = user.id;
    this.expandedCollectionId = null;
    this.collectionSearch = "";
    this.selectedUserDTO = { id: user.id, collections: [] };
    this.isUserLoading = true;

    this.service.getUserAdminDashboard(user.id).subscribe({
      next: (data) => {
        if (this.selectedUserId !== user.id) {
          return;
        }

        const dto = data as Partial<AdminUserDetailDTO> & { schools?: CollectionDTO[] };
        const collections = Array.isArray(dto.collections)
          ? dto.collections
          : Array.isArray(dto.schools)
            ? dto.schools
            : [];

        this.selectedUserDTO = {
          id: dto.id ?? user.id,
          collections: collections.map((collection) => this.normalizeCollection(collection)),
        };

        this.loadSelectedUserCollectionAvatars();
      },
      error: () => {
        if (this.selectedUserId === user.id) {
          this.selectedUserDTO = { id: user.id, collections: [] };
          this.isUserLoading = false;
        }

        this.showMessage("User-Collections konnten nicht geladen werden.", 3000);
      },
      complete: () => {
        if (this.selectedUserId === user.id) {
          this.isUserLoading = false;
        }
      },
    });
  }

  toggleCollectionDetails(collection: CollectionDTO): void {
    this.expandedCollectionId = this.isCollectionExpanded(collection) ? null : collection.id;
  }

  isCollectionExpanded(collection: CollectionDTO): boolean {
    return this.expandedCollectionId === collection.id;
  }

  copyUserId(user: AdminUserDashboardDTO, event?: MouseEvent): void {
    event?.stopPropagation();

    navigator.clipboard
      .writeText(String(user.id))
      .then(() => this.showMessage(`User-ID ${user.id} kopiert`))
      .catch(() => this.showMessage("Konnte User-ID nicht kopieren"));
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
    return normalized ? normalized.slice(0, 2).toUpperCase() : "--";
  }

  getAvatarUrl(user: AvatarUser | null | undefined): string | null {
    if (!user?.profileImageUrl) {
      return null;
    }

    return this.avatarUrls.get(user.id) ?? null;
  }

  getLastActiveLabel(value: string): string {
    const date = this.parseDate(value);

    if (!date) {
      return "Unbekannt";
    }

    const diffHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));

    if (diffHours < 1) {
      return "Gerade eben";
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

  getCollectionName(collection: CollectionDTO): string {
    return collection.name || "Unbenannte Collection";
  }

  getCollectionMemberCount(collection: CollectionDTO): number {
    return this.getCollectionMembers(collection).length;
  }

  getCollectionExampleCount(collection: CollectionDTO): number {
    return this.getCollectionExamples(collection).length;
  }

  getCollectionTestCount(collection: CollectionDTO): number {
    return this.getCollectionTests(collection).length;
  }

  getCollectionMembers(collection: CollectionDTO): UserDTO[] {
    return Array.isArray(collection.members) ? collection.members : [];
  }

  getCollectionExamples(collection: CollectionDTO): ExampleOverviewDTO[] {
    return Array.isArray(collection.examples) ? collection.examples : [];
  }

  getCollectionTests(collection: CollectionDTO): TestOverviewDTO[] {
    return Array.isArray(collection.tests) ? collection.tests : [];
  }

  getExampleTitle(example: ExampleOverviewDTO): string {
    return example.question || example.instruction || "Unbenanntes Beispiel";
  }

  getTestTitle(test: TestOverviewDTO): string {
    return test.name || "Unbenannter Test";
  }

  trackByUserId(_: number, user: AdminUserDashboardDTO): string {
    return user.id;
  }

  trackByCollection(index: number, collection: CollectionDTO): string {
    return collection.id ?? `${this.getCollectionName(collection)}-${index}`;
  }

  trackByMember(index: number, member: UserDTO): string {
    return member.id ?? `${member.username}-${index}`;
  }

  trackByExample(index: number, example: ExampleOverviewDTO): string {
    return example.id ?? `${this.getExampleTitle(example)}-${index}`;
  }

  trackByTest(index: number, test: TestOverviewDTO): string {
    return test.id ?? `${this.getTestTitle(test)}-${index}`;
  }

  private loadDashboardAvatars(): void {
    this.dash.users.forEach((user) => this.loadAvatar(user));
  }

  private loadSelectedUserCollectionAvatars(): void {
    this.selectedUserDTO.collections.forEach((collection) => {
      collection.members?.forEach((member) => this.loadAvatar(member));
    });
  }

  private loadAvatar(user: AvatarUser | null | undefined): void {
    if (!user?.profileImageUrl) {
      return;
    }

    const userId = user.id;

    if (this.loadingAvatarIds.has(userId)) {
      return;
    }

    this.loadingAvatarIds.add(userId);

    this.service
      .getProfileImage(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.revokeAvatarUrl(userId);
          this.avatarUrls.set(userId, URL.createObjectURL(blob));
          this.loadingAvatarIds.delete(userId);
          this.cdr.markForCheck();
        },
        error: () => {
          this.revokeAvatarUrl(userId);
          this.loadingAvatarIds.delete(userId);
          this.cdr.markForCheck();
        },
      });
  }

  private revokeAvatarUrl(userId: string): void {
    const url = this.avatarUrls.get(userId);

    if (url) {
      URL.revokeObjectURL(url);
      this.avatarUrls.delete(userId);
    }

    this.loadingAvatarIds.delete(userId);
  }

  private revokeAvatarUrls(): void {
    this.avatarUrls.forEach((url) => URL.revokeObjectURL(url));
    this.avatarUrls.clear();
    this.loadingAvatarIds.clear();
  }

  private get normalizedSearch(): string {
    return this.search.trim().toLowerCase();
  }

  private get normalizedCollectionSearch(): string {
    return this.collectionSearch.trim().toLowerCase();
  }

  private setNavbar(): void {
    this.navbarActions.setBreadcrumbs([{ label: "Admin Dashboard", route: ["/admin"] }] as any);
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

  private matchesCollectionSearch(collection: CollectionDTO, query: string): boolean {
    if (!query) {
      return true;
    }

    return [collection.id, this.getCollectionName(collection)]
      .map((value) => String(value ?? "").toLowerCase())
      .some((value) => value.includes(query));
  }

  private compareCollections(a: CollectionDTO, b: CollectionDTO): number {
    switch (this.collectionSort) {
      case "nameDesc":
        return this.getCollectionName(b).localeCompare(this.getCollectionName(a));
      case "membersDesc":
        return this.getCollectionMemberCount(b) - this.getCollectionMemberCount(a);
      case "examplesDesc":
        return this.getCollectionExampleCount(b) - this.getCollectionExampleCount(a);
      case "testsDesc":
        return this.getCollectionTestCount(b) - this.getCollectionTestCount(a);
      case "nameAsc":
      default:
        return this.getCollectionName(a).localeCompare(this.getCollectionName(b));
    }
  }

  private compareUsers(a: AdminUserDashboardDTO, b: AdminUserDashboardDTO): number {
    switch (this.sort) {
      case "newest":
        return this.dateTime(b.createdAt) - this.dateTime(a.createdAt);
      case "oldest":
        return this.dateTime(a.createdAt) - this.dateTime(b.createdAt);
      case "nameAsc":
        return a.username.localeCompare(b.username);
      case "nameDesc":
        return b.username.localeCompare(a.username);
      case "lastActive":
      default:
        return this.dateTime(b.lastActive) - this.dateTime(a.lastActive);
    }
  }

  private normalizeDashboard(data: AdminDashboardDTO): AdminDashboardDTO {
    return {
      ...this.createEmptyDashboard(),
      ...data,
      users: Array.isArray(data?.users) ? data.users : [],
      collections: data?.collections ?? this.emptyPeriod(),
      examples: data?.examples ?? this.emptyPeriod(),
      tests: data?.tests ?? this.emptyPeriod(),
    };
  }

  private normalizeCollection(collection: CollectionDTO): CollectionDTO {
    return {
      ...collection,
      examples: Array.isArray(collection.examples) ? collection.examples : [],
      tests: Array.isArray(collection.tests) ? collection.tests : [],
      members: Array.isArray(collection.members) ? collection.members : [],
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
      users: [],
    };
  }

  private emptyPeriod(): AdminCountPeriodDTO {
    return {
      hour: 0,
      day: 0,
      week: 0,
      month: 0,
      year: 0,
    };
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
    this.snack.open(message, "OK", { duration });
  }
}
