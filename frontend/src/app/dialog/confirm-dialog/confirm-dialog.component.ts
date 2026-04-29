import { Component, Inject } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core'

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    MatButton,
    FormsModule,
    MatCheckboxModule,
    MatIconModule,
    NgIf,
    TranslatePipe
  ],
  template: `
    <div class="dialog-header">
      <div class="title-icon">
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
        (click)="isChecked = !isChecked"
        [attr.aria-pressed]="isChecked"
      >
        <span class="confirm-check-box">
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
        (click)="onConfirm()"
        [disabled]="data.requireConfirmation && !isChecked">
        {{ data.confirmText }}
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
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
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
      requireConfirmation?: boolean;
      confirmationText?: string;
    }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
