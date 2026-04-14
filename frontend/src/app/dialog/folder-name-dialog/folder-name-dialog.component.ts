import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

export interface FolderNameDialogData {
  title: string;
  subtitle?: string;
  label: string;
  placeholder?: string;
  confirmText: string;
  cancelText: string;
  initialValue?: string;
}

@Component({
  selector: 'app-folder-name-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="dialog-shell">
      <div class="dialog-header">
        <div class="dialog-icon">
          <mat-icon>create_new_folder</mat-icon>
        </div>

        <div class="header-text">
          <h2>{{ data.title }}</h2>
          <p *ngIf="data.subtitle">{{ data.subtitle }}</p>
        </div>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ data.label }}</mat-label>
        <input
          matInput
          [(ngModel)]="value"
          [placeholder]="data.placeholder || ''"
          (keydown.enter)="confirm()"
          maxlength="120"
          cdkFocusInitial
        >
      </mat-form-field>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="close()">
          {{ data.cancelText }}
        </button>

        <button
          mat-flat-button
          color="primary"
          type="button"
          (click)="confirm()"
          [disabled]="!value.trim()"
        >
          {{ data.confirmText }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--menu-bg);
    }

    .dialog-shell {
      padding: 1.35rem 1.5rem 1.45rem;
    }

    .dialog-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      min-width: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
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
      color: var(--text-subtle);
      line-height: 1.5;
    }

    .full-width {
      width: 100%;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: .65rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }

    .dialog-actions button {
      min-width: 120px;
      font-weight: 600;
      border-radius: 10px;
    }
  `]
})
export class FolderNameDialogComponent {
  value = '';

  constructor(
    public dialogRef: MatDialogRef<FolderNameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FolderNameDialogData
  ) {
    this.value = this.data.initialValue ?? '';
  }

  close(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    const trimmed = this.value.trim();
    if (!trimmed) return;
    this.dialogRef.close(trimmed);
  }
}
