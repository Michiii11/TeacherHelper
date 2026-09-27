import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from "@angular/core";
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
  | "schoolSeatsTotal"
  | "revenueTotalCents"
  | "revenueMonthCents"
  | "successfulPayments"
  | "failedPayments"
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
  icon: string;
  format?: "number" | "currency";
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

type SubscriptionModel = "FREE" | "PRO" | "SCHOOL" | "ADMIN";
type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";
type SubscriptionSource = "FREE" | "STRIPE" | "ADMIN";
type DurationPreset = "unlimited" | "1m" | "3m" | "6m" | "12m" | "custom";

interface AdminPaymentDTO {
  id: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: "PAID" | "FAILED" | "REFUNDED";
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface AdminUserDetailDTO {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastActive: string;

  subscriptionModel: SubscriptionModel;
  subscriptionStatus: SubscriptionStatus;
  subscriptionSource: SubscriptionSource;
  subscriptionSeats: number | null;
  subscriptionValidUntil: string | null;
  subscriptionPeriodStart: string | null;
  subscriptionPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;

  locked: boolean;

  paymentCount: number;
  totalPaidCents: number;
  payments: AdminPaymentDTO[];
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
    { label: "User gesamt", key: "amountUsers", toneClass: "tone-users", icon: "group" },
    { label: "Aktiv im Monat", key: "activeUsersMonth", toneClass: "tone-active-month", icon: "calendar_month" },
    { label: "Aktiv in der Woche", key: "activeUsersWeek", toneClass: "tone-active-week", icon: "date_range" },
    { label: "Neue User im Monat", key: "newUsersMonth", toneClass: "tone-new-users", icon: "person_add" },
  ];

  readonly aboStatCards: StatCardConfig[] = [
    { label: "Free Abos", key: "freeAbos", toneClass: "tone-free", icon: "person_outline" },
    { label: "Pro Abos", key: "proAbos", toneClass: "tone-pro", icon: "workspace_premium" },
    { label: "School Abos", key: "schoolAbos", toneClass: "tone-collection", icon: "domain" },
    { label: "School Seats", key: "schoolSeatsTotal", toneClass: "tone-seats", icon: "groups" },
  ];

  readonly billingStatCards: StatCardConfig[] = [
    { label: "Umsatz gesamt", key: "revenueTotalCents", toneClass: "tone-revenue", icon: "payments", format: "currency" },
    { label: "Umsatz letzter Monat", key: "revenueMonthCents", toneClass: "tone-revenue-month", icon: "calendar_month", format: "currency" },
    { label: "Erfolgreiche Zahlungen", key: "successfulPayments", toneClass: "tone-payments", icon: "check_circle" },
    { label: "Fehlgeschlagene Zahlungen", key: "failedPayments", toneClass: "tone-failed", icon: "error_outline" },
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
  selectedUserDTO: AdminUserDetailDTO = this.emptyUserDetail();
  dash: AdminDashboardDTO = this.createEmptyDashboard();

  adminPlan: SubscriptionModel = "FREE";
  adminDurationPreset: DurationPreset = "unlimited";
  adminValidUntil = "";
  adminSeats = 20;

  isDashboardLoading = false;
  isUserLoading = false;
  isSavingSubscription = false;
  isUpdatingLock = false;
  refundingInvoiceId: string | null = null;
  isUserSearchOpen = false;
  isUserSortPopupOpen = false;
  isCollectionSearchOpen = false;
  isCollectionSortPopupOpen = false;

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

  @HostListener("document:click")
  onDocumentClick(): void {
    this.closeFloatingControls();
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
          this.selectedUserDTO = this.emptyUserDetail();
        }
      },
      error: () => {
        this.isDashboardLoading = false;
        this.showMessage("Admin Dashboard konnte nicht geladen werden.", 3000);
      },
      complete: () => (this.isDashboardLoading = false),
    });
  }

  clearSelectedUser(): void {
    this.selectedUserId = null;
    this.expandedCollectionId = null;
    this.collectionSearch = "";
    this.selectedUserDTO = this.emptyUserDetail();
    this.isUserLoading = false;
    this.closeFloatingControls();
  }

  selectUser(user: AdminUserDashboardDTO): void {
    this.selectedUserId = user.id;
    this.expandedCollectionId = null;
    this.collectionSearch = "";
    this.selectedUserDTO = this.emptyUserDetail(user.id);
    this.loadUserDetail(user.id);
  }

  get isStripeManaged(): boolean {
    return this.selectedUserDTO.subscriptionSource === "STRIPE";
  }

  get canSaveAdminSubscription(): boolean {
    if (!this.selectedUserId || this.isSavingSubscription || this.isStripeManaged) {
      return false;
    }

    if (this.adminPlan === "SCHOOL" && Number(this.adminSeats) < 20) {
      return false;
    }

    if (this.adminPlan !== "FREE" && this.adminDurationPreset === "custom" && !this.adminValidUntil) {
      return false;
    }

    return true;
  }

  onDurationPresetChange(preset: DurationPreset): void {
    this.adminDurationPreset = preset;

    if (preset === "unlimited") {
      this.adminValidUntil = "";
      return;
    }

    if (preset === "custom") {
      return;
    }

    const months = preset === "1m" ? 1 : preset === "3m" ? 3 : preset === "6m" ? 6 : 12;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    this.adminValidUntil = this.toDateInput(date);
  }

  onCustomDateChange(value: string): void {
    this.adminValidUntil = value;
    this.adminDurationPreset = "custom";
  }

  saveAdminSubscription(): void {
    if (!this.selectedUserId || !this.canSaveAdminSubscription) {
      return;
    }

    this.isSavingSubscription = true;

    const payload = {
      subscriptionModel: this.adminPlan,
      validUntil: this.adminPlan === "FREE" ? null : this.buildValidUntil(),
      seats: this.adminPlan === "SCHOOL" ? Math.max(20, Number(this.adminSeats) || 20) : null,
    };

    this.service.updateAdminSubscription(this.selectedUserId, payload).subscribe({
      next: () => {
        this.showMessage("Tier wurde aktualisiert.");
        const userId = this.selectedUserId;
        this.loadDashboard();
        if (userId) {
          this.loadUserDetail(userId);
        }
      },
      error: (error) => {
        this.showMessage(this.getApiErrorMessage(error, "Tier konnte nicht aktualisiert werden."), 3500);
        this.isSavingSubscription = false;
      },
      complete: () => (this.isSavingSubscription = false),
    });
  }

  setUserLocked(locked: boolean): void {
    if (!this.selectedUserId || this.isUpdatingLock) {
      return;
    }

    this.isUpdatingLock = true;
    const userId = this.selectedUserId;

    this.service.updateAdminLock(userId, locked).subscribe({
      next: () => {
        this.selectedUserDTO = { ...this.selectedUserDTO, locked };
        const dashboardUser = this.dash.users.find((entry) => entry.id === userId);
        if (dashboardUser) {
          dashboardUser.locked = locked;
        }
        this.showMessage(locked ? "User wurde gesperrt." : "User wurde entsperrt.");
      },
      error: (error) => {
        this.showMessage(this.getApiErrorMessage(error, "Sperrstatus konnte nicht geändert werden."), 3500);
        this.isUpdatingLock = false;
      },
      complete: () => (this.isUpdatingLock = false),
    });
  }

  getSubscriptionEndLabel(): string {
    const value = this.selectedUserDTO.subscriptionValidUntil ?? this.selectedUserDTO.subscriptionPeriodEnd;
    if (value) {
      return this.formatDate(value);
    }

    if (this.selectedUserDTO.subscriptionSource === "ADMIN" && this.selectedUserDTO.subscriptionModel !== "FREE") {
      return "Unbegrenzt";
    }

    return "—";
  }

  getSubscriptionStartLabel(): string {
    return this.selectedUserDTO.subscriptionPeriodStart
      ? this.formatDate(this.selectedUserDTO.subscriptionPeriodStart)
      : "—";
  }

  getPlanLabel(plan: SubscriptionModel | null | undefined): string {
    switch (plan) {
      case "PRO": return "Pro";
      case "SCHOOL": return "School";
      case "ADMIN": return "Admin";
      default: return "Free";
    }
  }

  getStatusLabel(status: SubscriptionStatus | null | undefined): string {
    switch (status) {
      case "PAST_DUE": return "Zahlung offen";
      case "INCOMPLETE": return "Unvollständig";
      case "CANCELED": return "Gekündigt";
      default: return "Aktiv";
    }
  }

  getSourceLabel(source: SubscriptionSource | null | undefined): string {
    switch (source) {
      case "STRIPE": return "Stripe";
      case "ADMIN": return "Manuell";
      default: return "Free";
    }
  }

  refundPayment(payment: AdminPaymentDTO): void {
    if (
      payment.status !== "PAID" ||
      !payment.stripeInvoiceId ||
      this.refundingInvoiceId !== null
    ) {
      return;
    }

    const amount = this.formatMoney(payment.amountCents, payment.currency);
    const confirmed = window.confirm(
      `${amount} vollständig erstatten?\n\nDie Rückerstattung wird direkt bei Stripe ausgelöst.`,
    );

    if (!confirmed) {
      return;
    }

    const userId = this.selectedUserId;
    this.refundingInvoiceId = payment.stripeInvoiceId;

    this.service.refundAdminPayment(payment.stripeInvoiceId).subscribe({
      next: (result) => {
        this.showMessage(
          result.fullyRefunded
            ? "Zahlung wurde vollständig erstattet."
            : "Rückerstattung wurde bei Stripe ausgelöst.",
          3000,
        );

        this.loadDashboard();
        if (userId) {
          this.loadUserDetail(userId);
        }
      },
      error: (error) => {
        this.showMessage(
          this.getApiErrorMessage(
            error,
            "Rückerstattung konnte nicht durchgeführt werden.",
          ),
          4000,
        );
        this.refundingInvoiceId = null;
      },
      complete: () => {
        this.refundingInvoiceId = null;
      },
    });
  }

  getPaymentStatusLabel(status: AdminPaymentDTO["status"]): string {
    switch (status) {
      case "FAILED": return "Fehlgeschlagen";
      case "REFUNDED": return "Erstattet";
      default: return "Bezahlt";
    }
  }

  formatMoney(amountCents: number | null | undefined, currency = "EUR"): string {
    const amount = Number(amountCents ?? 0) / 100;
    try {
      return new Intl.NumberFormat("de-AT", {
        style: "currency",
        currency: (currency || "EUR").toUpperCase(),
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} €`;
    }
  }

  formatDate(value: string | null | undefined): string {
    const date = this.parseDate(value);
    return date ? new Intl.DateTimeFormat("de-AT").format(date) : "—";
  }

  toggleCollectionDetails(collection: CollectionDTO): void {
    this.expandedCollectionId = this.isCollectionExpanded(collection) ? null : collection.id;
  }

  stopClick(event: Event): void {
    event.stopPropagation();
  }

  openUserSearch(event: Event): void {
    event.stopPropagation();
    this.isUserSearchOpen = true;
    this.isUserSortPopupOpen = false;
  }

  toggleUserSearch(event: Event): void {
    event.stopPropagation();
    this.isUserSearchOpen = !this.isUserSearchOpen;
    this.isUserSortPopupOpen = false;
  }

  clearUserSearch(event: Event): void {
    event.stopPropagation();
    this.search = "";
    this.isUserSearchOpen = false;
  }

  toggleUserSortPopup(event: Event): void {
    event.stopPropagation();
    const next = !this.isUserSortPopupOpen;
    this.closeFloatingControls();
    this.isUserSortPopupOpen = next;
  }

  setUserSort(sort: AdminSortKey): void {
    this.sort = sort;
    this.isUserSortPopupOpen = false;
  }

  getUserSortLabel(sort: AdminSortKey): string {
    return this.sortOptions.find((option) => option.value === sort)?.label ?? "Sortieren";
  }

  openCollectionSearch(event: Event): void {
    event.stopPropagation();
    this.isCollectionSearchOpen = true;
    this.isCollectionSortPopupOpen = false;
  }

  toggleCollectionSearch(event: Event): void {
    event.stopPropagation();
    this.isCollectionSearchOpen = !this.isCollectionSearchOpen;
    this.isCollectionSortPopupOpen = false;
  }

  clearCollectionSearch(event: Event): void {
    event.stopPropagation();
    this.collectionSearch = "";
    this.isCollectionSearchOpen = false;
  }

  toggleCollectionSortPopup(event: Event): void {
    event.stopPropagation();
    const next = !this.isCollectionSortPopupOpen;
    this.closeFloatingControls();
    this.isCollectionSortPopupOpen = next;
  }

  setCollectionSort(sort: CollectionSortKey): void {
    this.collectionSort = sort;
    this.isCollectionSortPopupOpen = false;
  }

  getCollectionSortLabel(sort: CollectionSortKey): string {
    return this.collectionSortOptions.find((option) => option.value === sort)?.label ?? "Sortieren";
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

  getStatDisplay(card: StatCardConfig): string {
    const value = Number(this.dash[card.key] ?? 0);
    return card.format === "currency" ? this.formatMoney(value) : value.toLocaleString("de-AT");
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

  private loadUserDetail(userId: string): void {
    this.isUserLoading = true;

    this.service.getUserAdminDashboard(userId).subscribe({
      next: (data) => {
        if (this.selectedUserId !== userId) {
          return;
        }

        const dto = data as Partial<AdminUserDetailDTO> & { schools?: CollectionDTO[] };
        const collections = Array.isArray(dto.collections)
          ? dto.collections
          : Array.isArray(dto.schools)
            ? dto.schools
            : [];

        const dashboardUser = this.dash.users.find((entry) => entry.id === userId);
        this.selectedUserDTO = {
          ...this.emptyUserDetail(userId),
          username: dto.username ?? dashboardUser?.username ?? "",
          email: dto.email ?? "",
          createdAt: dto.createdAt ?? dashboardUser?.createdAt ?? "",
          lastActive: dto.lastActive ?? dashboardUser?.lastActive ?? "",
          subscriptionModel: dto.subscriptionModel ?? dashboardUser?.subscriptionModel ?? "FREE",
          subscriptionStatus: dto.subscriptionStatus ?? dashboardUser?.subscriptionStatus ?? "ACTIVE",
          subscriptionSource: dto.subscriptionSource ?? dashboardUser?.subscriptionSource ?? "FREE",
          subscriptionSeats: dto.subscriptionSeats ?? dashboardUser?.subscriptionSeats ?? null,
          subscriptionValidUntil: dto.subscriptionValidUntil ?? dashboardUser?.subscriptionValidUntil ?? null,
          subscriptionPeriodStart: dto.subscriptionPeriodStart ?? dashboardUser?.subscriptionPeriodStart ?? null,
          subscriptionPeriodEnd: dto.subscriptionPeriodEnd ?? dashboardUser?.subscriptionPeriodEnd ?? null,
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? dashboardUser?.cancelAtPeriodEnd ?? false,
          locked: dto.locked ?? dashboardUser?.locked ?? false,
          paymentCount: Number(dto.paymentCount ?? dashboardUser?.paymentCount ?? 0),
          totalPaidCents: Number(dto.totalPaidCents ?? dashboardUser?.totalPaidCents ?? 0),
          payments: Array.isArray(dto.payments) ? dto.payments : [],
          collections: collections.map((collection) => this.normalizeCollection(collection)),
        };

        this.syncDashboardUserFromDetail(userId);
        this.applyDetailToEditor();
        this.loadSelectedUserCollectionAvatars();
      },
      error: () => {
        if (this.selectedUserId === userId) {
          this.selectedUserDTO = this.emptyUserDetail(userId);
          this.isUserLoading = false;
        }
        this.showMessage("User-Details konnten nicht geladen werden.", 3000);
      },
      complete: () => {
        if (this.selectedUserId === userId) {
          this.isUserLoading = false;
        }
      },
    });
  }

  private syncDashboardUserFromDetail(userId: string): void {
    const index = this.dash.users.findIndex((entry) => entry.id === userId);
    if (index < 0) {
      return;
    }

    const current = this.dash.users[index];
    const detail = this.selectedUserDTO;

    this.dash.users[index] = {
      ...current,
      subscriptionModel: detail.subscriptionModel,
      subscriptionStatus: detail.subscriptionStatus,
      subscriptionSource: detail.subscriptionSource,
      subscriptionSeats: detail.subscriptionSeats,
      subscriptionValidUntil: detail.subscriptionValidUntil,
      subscriptionPeriodStart: detail.subscriptionPeriodStart,
      subscriptionPeriodEnd: detail.subscriptionPeriodEnd,
      cancelAtPeriodEnd: detail.cancelAtPeriodEnd,
      locked: detail.locked,
      paymentCount: detail.paymentCount,
      totalPaidCents: detail.totalPaidCents,
    };

    // Replace the array reference as well so Angular reliably refreshes the row.
    this.dash = {
      ...this.dash,
      users: [...this.dash.users],
    };
  }

  private applyDetailToEditor(): void {
    this.adminPlan = this.selectedUserDTO.subscriptionModel;
    this.adminSeats = Math.max(20, Number(this.selectedUserDTO.subscriptionSeats ?? 20));
    this.adminValidUntil = this.selectedUserDTO.subscriptionValidUntil
      ? this.toDateInput(new Date(this.selectedUserDTO.subscriptionValidUntil))
      : "";
    this.adminDurationPreset = this.adminValidUntil ? "custom" : "unlimited";
  }

  private buildValidUntil(): string | null {
    if (this.adminDurationPreset === "unlimited" || !this.adminValidUntil) {
      return null;
    }
    return `${this.adminValidUntil}T23:59:59`;
  }

  private toDateInput(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private emptyUserDetail(id = ""): AdminUserDetailDTO {
    return {
      id,
      username: "",
      email: "",
      createdAt: "",
      lastActive: "",
      subscriptionModel: "FREE",
      subscriptionStatus: "ACTIVE",
      subscriptionSource: "FREE",
      subscriptionSeats: null,
      subscriptionValidUntil: null,
      subscriptionPeriodStart: null,
      subscriptionPeriodEnd: null,
      cancelAtPeriodEnd: false,
      locked: false,
      paymentCount: 0,
      totalPaidCents: 0,
      payments: [],
      collections: [],
    };
  }

  private getApiErrorMessage(error: any, fallback: string): string {
    const entity = error?.error;
    if (typeof entity === "string" && entity.trim()) {
      return entity;
    }
    if (entity?.message) {
      return String(entity.message);
    }
    return fallback;
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

  private closeFloatingControls(): void {
    this.isUserSortPopupOpen = false;
    this.isCollectionSortPopupOpen = false;

    if (!this.search.trim()) {
      this.isUserSearchOpen = false;
    }

    if (!this.collectionSearch.trim()) {
      this.isCollectionSearchOpen = false;
    }
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
      revenueTotalCents: 0,
      revenueMonthCents: 0,
      successfulPayments: 0,
      failedPayments: 0,
      schoolSeatsTotal: 0,
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

  private parseDate(value: string | null | undefined): Date | null {
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
