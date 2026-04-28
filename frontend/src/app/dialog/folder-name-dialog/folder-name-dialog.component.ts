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
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
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
