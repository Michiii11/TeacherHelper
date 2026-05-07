import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

export interface ConfirmDialogSummaryItem {
  icon?: string;
  label: string;
  value: string | number;
  tone?: 'default' | 'warn' | 'danger' | 'success';
}

export interface ConfirmDialogSection {
  title: string;
  icon?: string;
  items?: string[];
  emptyText?: string;
  moreText?: string;
  tone?: 'default' | 'warn' | 'danger';
}

export interface ConfirmDialogData {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  requireConfirmation?: boolean;
  confirmationText?: string;
  summaryItems?: ConfirmDialogSummaryItem[];
  sections?: ConfirmDialogSection[];
  warningTitle?: string;
  warningText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    NgClass,
    FormsModule,
    MatButton,
    MatCheckboxModule,
    MatIconModule,
    TranslatePipe
  ],
  template: `
    <div class="confirm-dialog-shell">
      <div class="confirm-dialog-header">
        <div class="confirm-dialog-icon" aria-hidden="true">
          <mat-icon>warning_amber</mat-icon>
        </div>

        <div class="confirm-dialog-title-copy">
          <h2>{{ data.title }}</h2>
          <p *ngIf="data.message">{{ data.message }}</p>
        </div>
      </div>

      <div *ngIf="data.summaryItems?.length" class="confirm-summary-grid">
        <div
          *ngFor="let item of data.summaryItems"
          class="confirm-summary-card"
          [ngClass]="'tone-' + (item.tone || 'default')"
        >
          <div class="confirm-summary-icon" *ngIf="item.icon">
            <mat-icon>{{ item.icon }}</mat-icon>
          </div>

          <div class="confirm-summary-copy">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>

      <section *ngIf="data.sections?.length" class="confirm-section-list">
        <article
          *ngFor="let section of data.sections"
          class="confirm-section"
          [ngClass]="'tone-' + (section.tone || 'default')"
        >
          <header class="confirm-section-head">
            <mat-icon *ngIf="section.icon">{{ section.icon }}</mat-icon>
            <h3>{{ section.title }}</h3>
          </header>

          <ul *ngIf="section.items?.length; else emptySection">
            <li *ngFor="let item of limitedItems(section.items)">
              <span>{{ item }}</span>
            </li>
          </ul>

          <div *ngIf="hasMoreItems(section.items)" class="confirm-section-more">
            {{ getMoreText(section) }}
          </div>

          <ng-template #emptySection>
            <p class="confirm-section-empty">{{ section.emptyText }}</p>
          </ng-template>
        </article>
      </section>

      <div *ngIf="data.warningTitle || data.warningText" class="confirm-warning-box">
        <mat-icon>info</mat-icon>
        <div>
          <strong *ngIf="data.warningTitle">{{ data.warningTitle }}</strong>
          <p *ngIf="data.warningText">{{ data.warningText }}</p>
        </div>
      </div>

      <div *ngIf="data.requireConfirmation" class="confirm-checkbox-wrapper">
        <button
          type="button"
          class="confirm-check"
          [class.checked]="isChecked"
          [attr.aria-pressed]="isChecked"
          (click)="toggleConfirmation()"
        >
          <span class="confirm-check-box" aria-hidden="true">
            <mat-icon *ngIf="isChecked">check</mat-icon>
          </span>

          <span class="confirm-check-label">
            {{ data.confirmationText || ('dialog.confirmAction' | translate) }}
          </span>
        </button>
      </div>

      <div class="confirm-dialog-actions">
        <button mat-stroked-button type="button" (click)="onCancel()">
          {{ data.cancelText }}
        </button>

        <button
          mat-flat-button
          color="warn"
          type="button"
          [disabled]="isConfirmDisabled"
          (click)="onConfirm()"
        >
          {{ data.confirmText }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text);
      background: transparent;
      min-width: min(100%, 420px);
    }

    .confirm-dialog-shell {
      padding: 1.35rem;
      color: var(--text);
      border-radius: 22px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      background: var(--surface);
    }

    .confirm-dialog-header {
      display: flex;
      align-items: flex-start;
      gap: .9rem;
      margin-bottom: .95rem;
    }

    .confirm-dialog-icon {
      flex: 0 0 auto;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      color: var(--primary);
      background: var(--primary-soft);
      border: 1px solid var(--primary-border-medium);
    }

    .confirm-dialog-icon mat-icon {
      font-size: 27px;
      width: 27px;
      height: 27px;
    }

    .confirm-dialog-title-copy h2 {
      margin: 0;
      font-size: 1.28rem;
      line-height: 1.18;
      font-weight: 800;
      letter-spacing: -.025em;
      color: var(--text);
    }

    .confirm-dialog-title-copy p {
      margin: .35rem 0 0;
      color: var(--text-subtle);
      line-height: 1.45;
      white-space: pre-line;
      font-size: .93rem;
    }

    .confirm-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
      gap: .6rem;
      margin: .9rem 0;
    }

    .confirm-summary-card {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .72rem .78rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface-soft);
    }

    .confirm-summary-icon {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: var(--primary-soft);
      color: var(--primary);
      flex: 0 0 auto;
    }

    .confirm-summary-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .confirm-summary-copy {
      display: flex;
      flex-direction: column;
      gap: .12rem;
      min-width: 0;
    }

    .confirm-summary-copy strong {
      font-size: 1.05rem;
      line-height: 1;
      color: var(--text);
    }

    .confirm-summary-copy span {
      color: var(--text-subtle);
      font-size: .82rem;
      font-weight: 650;
    }

    .confirm-section-list {
      display: grid;
      gap: .65rem;
      margin-top: 1rem;
    }

    .confirm-section {
      padding: .82rem;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .confirm-section-head {
      display: flex;
      align-items: center;
      gap: .5rem;
      margin-bottom: .55rem;
    }

    .confirm-section-head mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--primary);
    }

    .confirm-section-head h3 {
      margin: 0;
      font-size: .78rem;
      letter-spacing: .045em;
      text-transform: uppercase;
      color: var(--text-subtle);
      font-weight: 800;
    }

    .confirm-section ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: .36rem;
    }

    .confirm-section li {
      display: flex;
      align-items: center;
      color: var(--text);
      line-height: 1.25;
      min-width: 0;
      padding-inline: .5rem;
      padding-block: .25rem;
      border-top: 1px solid var(--border);
    }

    .confirm-section li span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .confirm-section-more,
    .confirm-section-empty {
      margin: .55rem .15rem 0;
      color: var(--text-subtle);
      font-size: .86rem;
      font-weight: 650;
    }

    .confirm-warning-box {
      display: flex;
      gap: .65rem;
      margin-top: 1rem;
      padding: .82rem;
      border-radius: 13px;
      background: color-mix(in srgb, var(--warning-surface) 22%, transparent);
      border: 1px solid color-mix(in srgb, var(--orange-strong) 20%, transparent);
      color: var(--text);
    }

    .confirm-warning-box mat-icon {
      color: var(--orange-strong);
      flex: 0 0 auto;
    }

    .confirm-warning-box strong {
      display: block;
      margin-bottom: .15rem;
      color: var(--text);
    }

    .confirm-warning-box p {
      margin: 0;
      color: var(--text-subtle);
      line-height: 1.4;
      font-size: .9rem;
    }

    .confirm-checkbox-wrapper {
      margin-top: 1rem;
    }

    .confirm-check {
      width: 100%;
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .86rem 1rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface-soft);
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    .confirm-check:hover {
      border-color: var(--primary-border-medium);
      background: var(--primary-soft);
    }

    .confirm-check-box {
      width: 22px;
      height: 22px;
      border-radius: 7px;
      border: 1.5px solid var(--border-strong);
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: white;
    }

    .confirm-check.checked .confirm-check-box {
      background: var(--primary);
      border-color: var(--primary);
    }

    .confirm-check-box mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .confirm-check-label {
      font-weight: 700;
      line-height: 1.35;
      color: var(--text);
    }

    .confirm-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: .65rem;
      margin-top: 1.15rem;
      flex-wrap: wrap;
    }

    .confirm-dialog-actions button {
      min-width: 120px;
      font-weight: 700;
      border-radius: 11px;
    }

    @media (max-width: 560px) {
      .confirm-dialog-shell {
        padding: 1.2rem;
      }

      .confirm-summary-grid {
        grid-template-columns: 1fr;
      }

      .confirm-dialog-actions button {
        flex: 1 1 100%;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  readonly maxPreviewItems = 3;
  isChecked = false;

  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    private readonly translate: TranslateService,
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmDialogData
  ) {}

  get isConfirmDisabled(): boolean {
    return !!this.data.requireConfirmation && !this.isChecked;
  }

  limitedItems(items: string[] | undefined): string[] {
    return (items ?? []).slice(0, this.maxPreviewItems);
  }

  hasMoreItems(items: string[] | undefined): boolean {
    return (items?.length ?? 0) > this.maxPreviewItems;
  }

  remainingItemCount(items: string[] | undefined): number {
    return Math.max((items?.length ?? 0) - this.maxPreviewItems, 0);
  }

  getMoreText(section: ConfirmDialogSection): string {
    const count = this.remainingItemCount(section.items);
    return section.moreText || this.translate.instant('dialog.moreItems', { count });
  }

  toggleConfirmation(): void {
    this.isChecked = !this.isChecked;
  }

  onConfirm(): void {
    if (this.isConfirmDisabled) {
      return;
    }

    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
