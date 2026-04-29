import { NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  requireConfirmation?: boolean;
  confirmationText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    MatButton,
    MatCheckboxModule,
    MatIconModule,
    TranslatePipe
  ],
  template: `
    <div class="dialog-header">
      <div class="title-icon" aria-hidden="true">
        <mat-icon>warning_amber</mat-icon>
      </div>

      <div>
        <h2>{{ data.title }}</h2>
        <p>{{ data.message }}</p>
      </div>
    </div>

    <div *ngIf="data.requireConfirmation" class="checkbox-wrapper">
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

    <div class="dialog-actions">
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
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
      background: var(--menu-bg);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: .65rem;
      margin-top: 1.2rem;
      flex-wrap: wrap;
    }

    .dialog-actions button {
      min-width: 120px;
      font-weight: 600;
      border-radius: 10px;
    }
  `]
})
export class ConfirmDialogComponent {
  isChecked = false;

  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmDialogData
  ) {}


  get isConfirmDisabled(): boolean {
    return !!this.data.requireConfirmation && !this.isChecked;
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
