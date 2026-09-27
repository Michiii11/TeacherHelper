import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaidSubscriptionPlan } from '../../model/Subscription';

export interface SubscriptionChangeDialogData {
  currentPlan: PaidSubscriptionPlan;
  targetPlan: PaidSubscriptionPlan;
  targetSeats: number;
  currentMonthlyAmountCents: number;
  newMonthlyAmountCents: number;
  monthlyDifferenceCents: number;
  currentPeriodAdjustmentCents: number;
  nextInvoiceAmountCents: number;
  nextBillingAt: number;
  prorationDate: number;
  currency: string;
  cancelAtPeriodEnd: boolean;
}

@Component({
  selector: 'app-subscription-change-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './subscription-change-dialog.component.html',
  styleUrl: './subscription-change-dialog.component.scss',
})
export class SubscriptionChangeDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: SubscriptionChangeDialogData,
    private readonly dialogRef: MatDialogRef<SubscriptionChangeDialogComponent, boolean>,
    private readonly translate: TranslateService,
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  get isUpgrade(): boolean {
    return this.data.monthlyDifferenceCents > 0;
  }

  get adjustmentIsCharge(): boolean {
    return this.data.currentPeriodAdjustmentCents >= 0;
  }

  get targetPlanLabel(): string {
    if (this.data.targetPlan === 'SCHOOL') {
      return `School · ${this.data.targetSeats} ${this.translate.instant('profile.subscription.billingDialog.users')}`;
    }

    return 'Pro';
  }

  get currentPlanLabel(): string {
    return this.data.currentPlan === 'SCHOOL' ? 'School' : 'Pro';
  }

  money(cents: number, showSign = false): string {
    const locale = (this.translate.currentLang || '').toLowerCase().startsWith('en')
      ? 'en-US'
      : 'de-AT';

    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: (this.data.currency || 'EUR').toUpperCase(),
    }).format(Math.abs(cents) / 100);

    if (!showSign || cents === 0) {
      return formatted;
    }

    return `${cents > 0 ? '+' : '−'}${formatted}`;
  }

  date(epochSeconds: number): string {
    if (!epochSeconds) return '—';

    const locale = (this.translate.currentLang || '').toLowerCase().startsWith('en')
      ? 'en-US'
      : 'de-AT';

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Vienna',
    }).format(new Date(epochSeconds * 1000));
  }

  get billingDay(): string {
    if (!this.data.nextBillingAt) return '—';

    return new Intl.DateTimeFormat(
      (this.translate.currentLang || '').toLowerCase().startsWith('en') ? 'en-US' : 'de-AT',
      { day: 'numeric', timeZone: 'Europe/Vienna' },
    ).format(new Date(this.data.nextBillingAt * 1000));
  }
}
