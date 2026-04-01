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

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    MatButton,
    FormsModule,
    MatCheckboxModule,
    MatIconModule,
    NgIf
  ],
  template: `
    <div class="dialog-shell">
      <div class="dialog-header">
        <div class="dialog-icon">
          <mat-icon>warning_amber</mat-icon>
        </div>

        <div class="header-text">
          <h2>{{ data.title }}</h2>
          <p>{{ data.message }}</p>
        </div>
      </div>

      <div *ngIf="data.requireConfirmation" class="checkbox-wrapper">
        <mat-checkbox [(ngModel)]="isChecked">
          {{ data.confirmationText || 'Ich bestätige diese Aktion' }}
        </mat-checkbox>
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
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .dialog-shell {
      padding: 1.35rem 1.5rem 1.45rem;
    }

    .dialog-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      min-width: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: var(--warn-soft);
      color: var(--warn);
    }

    .header-text h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
    }

    .header-text p {
      margin: .35rem 0 0;
      font-size: .92rem;
      color: var(--text-soft);
      line-height: 1.5;
    }

    .checkbox-wrapper {
      margin-top: 1rem;
      padding: .9rem 1rem;
      border-radius: 14px;
      background: var(--surface-2);
      border: 1px solid var(--border);
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
