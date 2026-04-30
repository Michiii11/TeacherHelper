import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-content" [class.saving]="isSaving">
      @if (isSaving) {
        <div class="loading-overlay">
          <mat-spinner diameter="42"></mat-spinner>
        </div>
      }

      <div class="dialog-header">
        <div class="title-icon">
          <mat-icon>create_new_folder</mat-icon>
        </div>

        <div>
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
          [disabled]="isSaving"
        >
      </mat-form-field>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="close()" [disabled]="isSaving">
          {{ data.cancelText }}
        </button>

        <button
          mat-flat-button
          color="primary"
          type="button"
          (click)="confirm()"
          [disabled]="isSaving || !value.trim()"
        >
          <mat-icon>{{ isSaving ? 'hourglass_top' : 'save' }}</mat-icon>
          {{ data.confirmText }}
        </button>
      </div>

      @if (isSaving) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
      position: relative;
    }

    .dialog-content {
      position: relative;
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

    .loading-overlay {
      position: absolute;
      inset: -1.4rem -1.5rem -1.6rem;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, .72);
      border-radius: 14px;
      backdrop-filter: blur(2px);
    }

    mat-progress-bar {
      margin-top: 1rem;
      border-radius: 999px;
      overflow: hidden;
    }
  `]
})
export class FolderNameDialogComponent {
  value = '';
  isSaving = false;

  constructor(
    public dialogRef: MatDialogRef<FolderNameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FolderNameDialogData
  ) {
    this.value = this.data.initialValue ?? '';
  }

  close(): void {
    if (this.isSaving) return;
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    const trimmed = this.value.trim();
    if (!trimmed || this.isSaving) return;

    this.isSaving = true;
    this.dialogRef.disableClose = true;

    this.dialogRef.close(trimmed);
  }
}
