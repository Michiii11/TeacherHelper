import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, finalize, take, takeUntil, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HttpService } from '../../service/http.service';
import { User, UserSettings } from '../../model/User';
import { PaidSubscriptionPlan, SubscriptionDTO } from '../../model/Subscription';
import { PaymentRecordDTO } from '../../model/Payment';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { SubscriptionChangeDialogComponent } from '../../dialog/subscription-change-dialog/subscription-change-dialog.component';
import { ThemeService } from '../../service/theme.service';
import { LanguageService } from '../../service/language.service';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AuthService } from '../../service/auth.service';

type ProfileLanguage = 'de' | 'en';
type ProfileSettings = {
  darkMode: boolean;
  language: ProfileLanguage;
  allowInvitations: boolean;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon, MatButton, MatFormFieldModule, MatInput, TranslatePipe, MatProgressBar],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  protected readonly translate = inject(TranslateService);
  private readonly navbarActions = inject(NavbarActionsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  user: User | null = null;
  loading = true;

  subscription: SubscriptionDTO | null = null;
  subscriptionLoading = true;
  subscriptionLoadError = false;

  payments: PaymentRecordDTO[] = [];
  paymentsLoading = true;
  paymentsLoadError = false;
  paymentHistoryExpanded = false;
  readonly paymentHistoryLimit = 12;
  readonly paymentHistoryPreviewCount = 5;

  startingCheckout = false;
  openingPortal = false;
  changingPlan = false;
  cancelingSubscription = false;
  resumingSubscription = false;
  readonly minSchoolSeats = 20;
  schoolSeats = 20;
  currentSchoolSeats = 20;

  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;
  avatarObjectUrl: string | null = null;

  savingUsername = false;
  savingAvatar = false;
  savingSettings = false;
  deletingAccount = false;
  isDraggingAvatar = false;

  private settingsReady = false;
  private lastSavedSettings: ProfileSettings = { darkMode: false, language: 'de', allowInvitations: true };
  private queuedSettings: ProfileSettings | null = null;

  readonly maxAvatarBytes = 2 * 1024 * 1024;
  readonly allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

  usernameForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]]
  });

  settingsForm = new FormGroup({
    darkMode: new FormControl<boolean>(false, { nonNullable: true }),
    language: new FormControl<ProfileLanguage>('de', { nonNullable: true, validators: [Validators.required] }),
    allowInvitations: new FormControl<boolean>(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.setupSettingsAutoSave();
    this.loadUser();
    this.loadSubscription();
    this.loadPayments();
    this.handleCheckoutReturn();
    this.setNavbarActions();
  }

  ngOnDestroy(): void {
    this.revokeAvatarObjectUrl();
    this.destroy$.next();
    this.destroy$.complete();
    this.navbarActions.clearAll();
  }

  private setNavbarActions(): void {
    this.navbarActions.setBreadcrumbs([{ labelKey: 'profile.title', route: '/profile' }]);
    this.navbarActions.setActions([{ labelKey: 'common.logout', icon: 'logout', variant: 'flat', action: () => this.logout() }]);
  }

  private handleCheckoutReturn(): void {
    const checkoutState = this.route.snapshot.queryParamMap.get('checkout');
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');

    if (checkoutState !== 'success' && checkoutState !== 'cancelled') {
      return;
    }

    // Remove Stripe return parameters immediately so a browser refresh does not
    // repeat the same confirmation flow.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        checkout: null,
        session_id: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (checkoutState === 'cancelled') {
      this.snack.open(
        this.translate.instant('profile.subscription.checkoutReturn.cancelled'),
        'OK',
        { duration: 3500 }
      );
      return;
    }

    this.snack.open(
      this.translate.instant('profile.subscription.checkoutReturn.success'),
      'OK',
      { duration: 5000 }
    );

    if (sessionId) {
      this.http.confirmSubscriptionCheckout(sessionId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadSubscription();
            this.loadPayments();
          },
          error: () => {
            // The webhook remains the source of truth. The retry loop below
            // will pick up the webhook-written state if direct confirmation
            // is temporarily unavailable.
          }
        });
    }

    timer(900, 1500)
      .pipe(
        take(3),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadSubscription();
        this.loadPayments();
      });
  }

  hasSubscriptionIssue(): boolean {
    return this.subscription?.status === 'PAST_DUE'
      || this.subscription?.status === 'INCOMPLETE';
  }

  getSubscriptionIssueIcon(): string {
    return this.subscription?.status === 'PAST_DUE'
      ? 'credit_card_off'
      : 'pending_actions';
  }

  getSubscriptionIssueTitle(): string {
    const status = this.subscription?.status?.toLowerCase();

    if (status !== 'past_due' && status !== 'incomplete') {
      return '';
    }

    return this.translate.instant(`profile.subscription.health.${status}.title`);
  }

  getSubscriptionIssueText(): string {
    const status = this.subscription?.status?.toLowerCase();

    if (status !== 'past_due' && status !== 'incomplete') {
      return '';
    }

    return this.translate.instant(`profile.subscription.health.${status}.text`);
  }

  loadUser(): void {
    this.loading = true;
    this.http.getUser()
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: (user: User) => {
          this.user = user;
          this.usernameForm.patchValue({ username: user?.username ?? '' });

          const resolvedSettings = this.resolveSettings(user.settings);
          this.settingsForm.patchValue(resolvedSettings, { emitEvent: false });
          this.applyResolvedSettings(resolvedSettings);
          this.lastSavedSettings = resolvedSettings;
          this.settingsReady = true;
          this.loadAvatar();
        },
        error: () => {
          this.snack.open(this.translate.instant('snackbar.userLoadedError'), 'OK', { duration: 3500 });
        }
      });
  }

  loadSubscription(): void {
    this.subscriptionLoading = true;
    this.subscriptionLoadError = false;

    this.http.getSubscription()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.subscriptionLoading = false)
      )
      .subscribe({
        next: (subscription: SubscriptionDTO) => {
          this.subscription = subscription;
          if (subscription.plan === 'SCHOOL' && subscription.seats) {
            const seats = Math.max(this.minSchoolSeats, subscription.seats);
            this.schoolSeats = seats;
            this.currentSchoolSeats = seats;
          }
        },
        error: () => {
          this.subscription = null;
          this.subscriptionLoadError = true;
        }
      });
  }

  loadPayments(): void {
    this.paymentsLoading = true;
    this.paymentsLoadError = false;

    this.http.getMyPayments(this.paymentHistoryLimit)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.paymentsLoading = false)
      )
      .subscribe({
        next: (payments: PaymentRecordDTO[]) => {
          this.payments = payments ?? [];
        },
        error: () => {
          this.payments = [];
          this.paymentsLoadError = true;
        }
      });
  }

  get visiblePayments(): PaymentRecordDTO[] {
    return this.paymentHistoryExpanded
      ? this.payments
      : this.payments.slice(0, this.paymentHistoryPreviewCount);
  }

  get hasMorePayments(): boolean {
    return this.payments.length > this.paymentHistoryPreviewCount;
  }

  togglePaymentHistory(): void {
    this.paymentHistoryExpanded = !this.paymentHistoryExpanded;
  }

  getPaymentStatusLabel(payment: PaymentRecordDTO): string {
    const status = payment.status.toLowerCase();
    return this.translate.instant(`profile.subscription.paymentHistory.statuses.${status}`);
  }

  formatPaymentDate(payment: PaymentRecordDTO): string {
    return this.formatSubscriptionDate(payment.paidAt ?? payment.createdAt);
  }

  private getLocale(): 'de-AT' | 'en-US' {
    return (this.translate.currentLang || '').toLowerCase().startsWith('en')
      ? 'en-US'
      : 'de-AT';
  }

  formatPaymentMoney(payment: PaymentRecordDTO): string {
    return new Intl.NumberFormat(this.getLocale(), {
      style: 'currency',
      currency: (payment.currency || 'EUR').toUpperCase()
    }).format((payment.amountCents ?? 0) / 100);
  }

  getUsagePercent(current: number, limit: number | null): number {
    if (limit === null || limit <= 0) return 0;
    return Math.min(100, Math.max(0, (current / limit) * 100));
  }

  getUsageText(current: number, limit: number | null): string {
    return `${current} / ${limit === null ? '∞' : limit}`;
  }

  getSubscriptionPlanLabel(): string {
    const plan = (this.subscription?.plan ?? this.user?.subscriptionModel ?? 'FREE').toLowerCase();
    return this.translate.instant(`profile.subscription.plans.${plan}`);
  }

  getSubscriptionPlanDescription(): string {
    const plan = (this.subscription?.plan ?? this.user?.subscriptionModel ?? 'FREE').toLowerCase();
    return this.translate.instant(`profile.subscription.descriptions.${plan}`);
  }

  getSubscriptionStatusLabel(): string {
    const status = this.subscription?.status?.toLowerCase() ?? 'active';
    return this.translate.instant(`profile.subscription.statuses.${status}`);
  }

  isSchoolPlan(): boolean {
    return this.subscription?.plan === 'SCHOOL';
  }

  getCurrentPlan(): 'FREE' | 'PRO' | 'SCHOOL' | 'ADMIN' {
    return this.subscription?.plan ?? this.user?.subscriptionModel ?? 'FREE';
  }

  isCurrentPlan(plan: 'FREE' | 'PRO' | 'SCHOOL'): boolean {
    return this.getCurrentPlan() === plan;
  }

  isStripeManagedSubscription(): boolean {
    return this.subscription?.source === 'STRIPE'
      && (this.getCurrentPlan() === 'PRO' || this.getCurrentPlan() === 'SCHOOL');
  }

  isAdminManagedSubscription(): boolean {
    return this.subscription?.source === 'ADMIN'
      && (this.getCurrentPlan() === 'PRO' || this.getCurrentPlan() === 'SCHOOL');
  }

  canStartPaidCheckout(_plan: PaidSubscriptionPlan): boolean {
    return this.getCurrentPlan() === 'FREE' && !this.startingCheckout;
  }

  hasSchoolSeatChanges(): boolean {
    return this.isCurrentPlan('SCHOOL') && this.schoolSeats !== this.currentSchoolSeats;
  }

  getMinimumSchoolSeatsRequired(): number {
    const collections = this.subscription?.usage.collections ?? 0;
    const schoolUsers = this.subscription?.usage.schoolUsers ?? 0;

    return Math.max(
      this.minSchoolSeats,
      collections,
      schoolUsers
    );
  }

  canUseProPlan(): boolean {
    if (!this.subscription) {
      return true;
    }

    return this.subscription.usage.collections <= 5
      && this.subscription.usage.examples <= 500
      && this.subscription.usage.tests <= 50
      && this.subscription.usage.maxCollectionMembers <= 5;
  }

  isCurrentPlanOverLimit(): boolean {
    if (!this.subscription) {
      return false;
    }

    const { usage, limits } = this.subscription;

    return this.isUsageOverLimit(usage.collections, limits.collections)
      || this.isUsageOverLimit(usage.examples, limits.examples)
      || this.isUsageOverLimit(usage.tests, limits.tests)
      || this.isUsageOverLimit(usage.maxCollectionMembers, limits.membersPerCollection)
      || this.isUsageOverLimit(usage.schoolUsers, limits.schoolUsers);
  }

  getCurrentPlanOverLimitItems(): string[] {
    if (!this.subscription) {
      return [];
    }

    const { usage, limits } = this.subscription;
    const items: string[] = [];

    if (this.isUsageOverLimit(usage.collections, limits.collections)) {
      items.push(this.translate.instant('profile.subscription.overLimit.items.collections', {
        current: usage.collections,
        limit: limits.collections,
      }));
    }

    if (this.isUsageOverLimit(usage.examples, limits.examples)) {
      items.push(this.translate.instant('profile.subscription.overLimit.items.examples', {
        current: usage.examples,
        limit: limits.examples,
      }));
    }

    if (this.isUsageOverLimit(usage.tests, limits.tests)) {
      items.push(this.translate.instant('profile.subscription.overLimit.items.tests', {
        current: usage.tests,
        limit: limits.tests,
      }));
    }

    if (this.isUsageOverLimit(usage.maxCollectionMembers, limits.membersPerCollection)) {
      items.push(this.translate.instant('profile.subscription.overLimit.items.members', {
        current: usage.maxCollectionMembers,
        limit: limits.membersPerCollection,
      }));
    }

    if (this.isUsageOverLimit(usage.schoolUsers, limits.schoolUsers)) {
      items.push(this.translate.instant('profile.subscription.overLimit.items.schoolUsers', {
        current: usage.schoolUsers,
        limit: limits.schoolUsers,
      }));
    }

    return items;
  }

  willExceedFreePlanAfterCancellation(): boolean {
    if (!this.subscription?.cancelAtPeriodEnd) {
      return false;
    }

    const usage = this.subscription.usage;

    return usage.collections > 1
      || usage.examples > 50
      || usage.tests > 5
      || usage.maxCollectionMembers > 0;
  }

  getFreePlanDowngradeItems(): string[] {
    if (!this.subscription) {
      return [];
    }

    const usage = this.subscription.usage;
    const items: string[] = [];

    if (usage.collections > 1) {
      items.push(this.translate.instant('profile.subscription.cancellationImpact.items.collections', {
        current: usage.collections,
        limit: 1,
      }));
    }

    if (usage.examples > 50) {
      items.push(this.translate.instant('profile.subscription.cancellationImpact.items.examples', {
        current: usage.examples,
        limit: 50,
      }));
    }

    if (usage.tests > 5) {
      items.push(this.translate.instant('profile.subscription.cancellationImpact.items.tests', {
        current: usage.tests,
        limit: 5,
      }));
    }

    if (usage.maxCollectionMembers > 0) {
      items.push(this.translate.instant('profile.subscription.cancellationImpact.items.members', {
        current: usage.maxCollectionMembers,
      }));
    }

    return items;
  }

  private isUsageOverLimit(current: number, limit: number | null): boolean {
    return limit !== null && current > limit;
  }

  updateSchoolSeats(event: Event): void {
    const minimumSeats = this.getMinimumSchoolSeatsRequired();
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value)) {
      this.schoolSeats = minimumSeats;
      return;
    }

    this.schoolSeats = Math.max(minimumSeats, Math.floor(value));
  }

  startCheckout(plan: PaidSubscriptionPlan, seats?: number): void {
    if (this.startingCheckout) return;

    const current = this.getCurrentPlan();

    if (current === 'ADMIN') {
      return;
    }

    // Do not create a second Stripe subscription for an already paid account.
    // Paid-plan changes/cancellation will be routed through Stripe Billing Portal
    // once the webhook/customer mapping is active.
    if (current !== 'FREE') {
      this.snack.open(
        this.translate.instant('profile.subscription.messages.existingPaidPlan'),
        'OK',
        { duration: 3800 }
      );
      return;
    }

    const normalizedSeats = plan === 'SCHOOL'
      ? Math.max(this.getMinimumSchoolSeatsRequired(), Math.floor(seats ?? this.schoolSeats))
      : undefined;

    this.startingCheckout = true;

    this.http.createSubscriptionCheckout(plan, normalizedSeats)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.startingCheckout = false)
      )
      .subscribe({
        next: ({ url }) => {
          if (url) {
            window.location.href = url;
          }
        },
        error: (err) => {
          this.snack.open(
            this.getSubscriptionActionError(
              err,
              'profile.subscription.messages.checkoutError'
            ),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  private getSubscriptionActionError(err: any, fallbackKey: string): string {
    if (err?.error?.code === 'SCHOOL_CAPACITY_BELOW_USAGE') {
      return this.translate.instant(
        'profile.subscription.messages.schoolCapacityBelowUsage',
        { minimumSeats: err?.error?.minimumSeats ?? this.getMinimumSchoolSeatsRequired() }
      );
    }

    if (err?.error?.code === 'PRO_CAPACITY_BELOW_USAGE') {
      return this.translate.instant(
        'profile.subscription.messages.proCapacityBelowUsage'
      );
    }

    return err?.error?.message || this.translate.instant(fallbackKey);
  }

  changePlan(plan: PaidSubscriptionPlan, seats?: number): void {
    if (this.changingPlan || !this.isStripeManagedSubscription()) return;

    const currentPlan = this.getCurrentPlan();
    if (currentPlan !== 'PRO' && currentPlan !== 'SCHOOL') return;

    const normalizedSeats = plan === 'SCHOOL'
      ? Math.max(this.getMinimumSchoolSeatsRequired(), Math.floor(seats ?? this.schoolSeats))
      : undefined;

    this.changingPlan = true;

    this.http.previewSubscriptionPlanChange(plan, normalizedSeats)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.changingPlan = false)
      )
      .subscribe({
        next: (preview) => {
          const dialogRef = this.dialog.open(SubscriptionChangeDialogComponent, {
            width: 'min(94vw, 720px)',
            maxWidth: '94vw',
            disableClose: true,
            panelClass: 'subscription-change-dialog-panel',
            data: {
              currentPlan,
              targetPlan: plan,
              targetSeats: preview.seats,
              currentMonthlyAmountCents: preview.currentMonthlyAmountCents,
              newMonthlyAmountCents: preview.newMonthlyAmountCents,
              monthlyDifferenceCents: preview.monthlyDifferenceCents,
              currentPeriodAdjustmentCents: preview.currentPeriodAdjustmentCents,
              nextInvoiceAmountCents: preview.nextInvoiceAmountCents,
              nextBillingAt: preview.nextBillingAt,
              prorationDate: preview.prorationDate,
              currency: preview.currency,
              cancelAtPeriodEnd: !!this.subscription?.cancelAtPeriodEnd
            }
          });

          dialogRef.afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((confirmed: boolean) => {
              if (!confirmed) return;
              this.executePlanChange(plan, normalizedSeats, preview.prorationDate);
            });
        },
        error: (err) => {
          this.snack.open(
            this.getSubscriptionActionError(
              err,
              'profile.subscription.billingPreview.failed'
            ),
            'OK',
            { duration: 4200 }
          );
        }
      });
  }

  private executePlanChange(
    plan: PaidSubscriptionPlan,
    normalizedSeats?: number,
    prorationDate?: number
  ): void {
    if (this.changingPlan || !this.isStripeManagedSubscription()) return;

    this.changingPlan = true;

    this.http.changeSubscriptionPlan(plan, normalizedSeats, prorationDate)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.changingPlan = false)
      )
      .subscribe({
        next: () => {
          this.snack.open(
            this.translate.instant('profile.subscription.messages.planChanged'),
            'OK',
            { duration: 3000 }
          );

          setTimeout(() => this.loadSubscription(), 800);
        },
        error: (err) => {
          this.snack.open(
            this.getSubscriptionActionError(
              err,
              'profile.subscription.messages.planChangeError'
            ),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  getCurrentMonthlyPriceCents(): number {
    const plan = this.getCurrentPlan();

    if (plan === 'PRO') return 500;

    if (plan === 'SCHOOL') {
      const seats = this.subscription?.seats ?? this.currentSchoolSeats ?? this.minSchoolSeats;
      return Math.max(this.minSchoolSeats, seats) * 100;
    }

    return 0;
  }

  getSubscriptionPeriodStart(): string | null {
    return this.subscription?.periodStart ?? null;
  }

  getSubscriptionPeriodEnd(): string | null {
    return this.subscription?.periodEnd ?? null;
  }

  formatSubscriptionDate(value: string | null | undefined): string {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat(this.getLocale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  formatSubscriptionMoney(amountCents: number): string {
    return new Intl.NumberFormat(this.getLocale(), {
      style: 'currency',
      currency: 'EUR'
    }).format((amountCents ?? 0) / 100);
  }

  confirmResumeSubscription(): void {
    if (this.resumingSubscription || !this.isStripeManagedSubscription() || !this.subscription?.cancelAtPeriodEnd) return;

    const endDate = this.formatSubscriptionDate(this.getSubscriptionPeriodEnd());
    const monthlyPrice = this.formatSubscriptionMoney(this.getCurrentMonthlyPriceCents());

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 540px)',
      maxWidth: '92vw',
      disableClose: true,
      data: {
        title: this.translate.instant('profile.subscription.resumeDialog.title'),
        message: this.translate.instant('profile.subscription.resumeDialog.message', {
          date: endDate,
          price: monthlyPrice
        }),
        confirmText: this.translate.instant('profile.subscription.resumeDialog.confirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (confirmed) this.resumeSubscription();
      });
  }

  private resumeSubscription(): void {
    if (this.resumingSubscription || !this.isStripeManagedSubscription()) return;

    this.resumingSubscription = true;

    this.http.resumeSubscription()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.resumingSubscription = false)
      )
      .subscribe({
        next: () => {
          this.snack.open(
            this.translate.instant('profile.subscription.resumeSuccess'),
            'OK',
            { duration: 3200 }
          );

          setTimeout(() => this.loadSubscription(), 800);
        },
        error: (err) => {
          this.snack.open(
            err?.error?.message || this.translate.instant('profile.subscription.resumeError'),
            'OK',
            { duration: 3600 }
          );
        }
      });
  }

  confirmCancelSubscription(): void {
    if (this.cancelingSubscription || !this.isStripeManagedSubscription() || this.subscription?.cancelAtPeriodEnd) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      disableClose: true,
      data: {
        title: this.translate.instant('profile.subscription.cancelDialog.title'),
        message: this.translate.instant('profile.subscription.cancelDialog.message'),
        confirmText: this.translate.instant('profile.subscription.cancelDialog.confirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (confirmed) this.cancelSubscription();
      });
  }

  private cancelSubscription(): void {
    if (this.cancelingSubscription || !this.isStripeManagedSubscription()) return;

    this.cancelingSubscription = true;

    this.http.cancelSubscription()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.cancelingSubscription = false)
      )
      .subscribe({
        next: () => {
          this.snack.open(
            this.translate.instant('profile.subscription.messages.cancellationScheduled'),
            'OK',
            { duration: 4200 }
          );

          setTimeout(() => this.loadSubscription(), 800);
        },
        error: (err) => {
          this.snack.open(
            err?.error?.message
            || this.translate.instant('profile.subscription.messages.cancelError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  openSubscriptionPortal(): void {
    if (this.openingPortal || !this.isStripeManagedSubscription()) return;

    this.openingPortal = true;

    this.http.createSubscriptionPortal()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.openingPortal = false)
      )
      .subscribe({
        next: ({ url }) => {
          if (url) {
            window.location.href = url;
          }
        },
        error: (err) => {
          this.snack.open(
            err?.error?.message
            || this.translate.instant('profile.subscription.messages.portalError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  private setupSettingsAutoSave(): void {
    this.settingsForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(350),
        distinctUntilChanged((prev, curr) => prev.darkMode === curr.darkMode && prev.language === curr.language && prev.allowInvitations === curr.allowInvitations)
      )
      .subscribe(() => {
        if (!this.settingsReady || this.settingsForm.invalid) return;
        const settings = this.getCurrentSettings();
        this.applyResolvedSettings(settings);
        this.persistSettings(settings);
      });
  }

  private resolveSettings(settings?: UserSettings | null): ProfileSettings {
    return {
      darkMode: this.themeService.resolveDarkMode(settings?.darkMode ?? null),
      language: this.languageService.resolveLanguage(settings?.language ?? null),
      allowInvitations: settings?.allowInvitations ?? true
    };
  }

  private getCurrentSettings(): ProfileSettings {
    return {
      darkMode: this.settingsForm.controls.darkMode.value,
      language: this.settingsForm.controls.language.value ?? 'de',
      allowInvitations: this.settingsForm.controls.allowInvitations.value
    };
  }

  private applyResolvedSettings(settings: ProfileSettings): void {
    this.themeService.setDarkMode(settings.darkMode);
    this.languageService.applyUserPreference(settings.language);
  }

  private persistSettings(settings: ProfileSettings): void {
    if (this.areSettingsEqual(settings, this.lastSavedSettings)) return;
    if (this.savingSettings) {
      this.queuedSettings = settings;
      return;
    }

    this.savingSettings = true;
    this.http.updateUserSettings({ darkMode: settings.darkMode, language: settings.language, allowInvitations: settings.allowInvitations })
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.savingSettings = false;
        if (this.queuedSettings) {
          const queued = { ...this.queuedSettings };
          this.queuedSettings = null;
          if (!this.areSettingsEqual(queued, this.lastSavedSettings)) this.persistSettings(queued);
        }
      }))
      .subscribe({
        next: () => {
          if (this.user) this.user.settings = { darkMode: settings.darkMode, language: settings.language, allowInvitations: settings.allowInvitations };
          this.lastSavedSettings = { ...settings };
        },
        error: (err) => {
          const fallback = this.lastSavedSettings;
          this.settingsForm.patchValue(fallback, { emitEvent: false });
          this.applyResolvedSettings(fallback);
          this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.settingsSaveError'), 'OK', { duration: 3500 });
        }
      });
  }

  private areSettingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
    return a.darkMode === b.darkMode && a.language === b.language && a.allowInvitations === b.allowInvitations;
  }

  saveUsername(): void {
    if (this.usernameForm.invalid || this.savingUsername) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    const username = this.usernameForm.controls.username.value?.trim() ?? '';
    this.savingUsername = true;
    this.http.updateUsername(username)
      .pipe(takeUntil(this.destroy$), finalize(() => this.savingUsername = false))
      .subscribe({
        next: () => {
          if (this.user) this.user.username = username;
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.usernameUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.usernameUpdateError'), 'OK', { duration: 3500 })
      });
  }

  confirmDeleteAccount(): void {
    if (this.deletingAccount) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      disableClose: true,
      data: {
        title: this.translate.instant('dialog.deleteAccountTitle'),
        message: this.translate.instant('dialog.deleteAccountMessage'),
        confirmText: this.translate.instant('dialog.deleteAccountConfirm'),
        cancelText: this.translate.instant('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.translate.instant('dialog.confirmPhrase')
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed: boolean) => {
      if (confirmed) this.deleteAccount();
    });
  }

  deleteAccount(): void {
    this.deletingAccount = true;
    this.http.deleteAccount()
      .pipe(takeUntil(this.destroy$), finalize(() => this.deletingAccount = false))
      .subscribe({
        next: () => this.auth.logout(),
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.accountDeleteError'), 'OK', { duration: 3500 })
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file) {
      this.setAvatarFile(file);
    }

    input.value = '';
  }

  onAvatarDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    this.isDraggingAvatar = true;
  }

  onAvatarDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDraggingAvatar = false;
  }

  onAvatarDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingAvatar = false;

    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) return;

    this.setAvatarFile(file);
  }

  private setAvatarFile(file: File): void {
    if (!this.allowedAvatarTypes.includes(file.type)) {
      this.snack.open(this.translate.instant('snackbar.imageTypeError'), 'OK', { duration: 3000 });
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snack.open(this.translate.instant('snackbar.imageSizeError'), 'OK', { duration: 3200 });
      return;
    }

    this.selectedAvatarFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  saveAvatar(): void {
    if (!this.selectedAvatarFile || this.savingAvatar) return;

    this.savingAvatar = true;
    this.http.uploadProfileImage(this.selectedAvatarFile)
      .pipe(takeUntil(this.destroy$), finalize(() => this.savingAvatar = false))
      .subscribe({
        next: (imageUrl: string) => {
          this.avatarPreviewUrl = null;
          if (this.user) this.user.profileImageUrl = imageUrl;
          this.selectedAvatarFile = null;
          this.loadAvatar();
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.avatarUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.avatarUpdateError'), 'OK', { duration: 3500 })
      });
  }

  clearAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
  }

  logout(): void { this.auth.logout(); }

  getDisplayName(): string { return this.user?.username || this.translate.instant('profile.fallbackName'); }
  getDisplayEmail(): string { return this.user?.email || this.translate.instant('profile.fallbackEmail'); }
  getPlanLabel(): string { return this.getSubscriptionPlanLabel(); }

  getAvatarUrl(): string | null {
    return this.avatarPreviewUrl || this.avatarObjectUrl;
  }

  private loadAvatar(): void {
    this.revokeAvatarObjectUrl();
    if (!this.user?.id || !this.user?.profileImageUrl) return;

    this.http.getProfileImage(this.user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          this.revokeAvatarObjectUrl();
          this.avatarObjectUrl = URL.createObjectURL(blob);
        },
        error: () => this.avatarObjectUrl = null
      });
  }

  private revokeAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  getInitials(): string { return this.http.getUserInitials(this.user); }

  hasUsernameError(error: string): boolean {
    return !!this.usernameForm.controls.username.touched && !!this.usernameForm.controls.username.hasError(error);
  }

  deleteAvatar(): void {
    if (!this.user?.profileImageUrl) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('dialog.deleteAvatarTitle'),
        message: this.translate.instant('dialog.deleteAvatarMessage'),
        confirmText: this.translate.instant('common.delete'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.http.deleteProfileImage()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (this.user) this.user.profileImageUrl = null;
            this.revokeAvatarObjectUrl();
            this.snack.open(this.translate.instant('snackbar.avatarDeleted'), 'OK', { duration: 3000 });
          },
          error: () => this.snack.open(this.translate.instant('snackbar.avatarDeleteError'), 'OK', { duration: 3000 })
        });
    });
  }
}
