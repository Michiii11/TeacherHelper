import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {NgIf} from '@angular/common'

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    MatButton,
    FormsModule,
    MatCheckboxModule,
    NgIf
  ],
  template: `

    <!-- HEADER -->
    <div class="dialog-header">
      <div class="header-text">
        <h2>{{ data.title }}</h2>
        <p>{{ data.message }}</p>
      </div>
    </div>

    <!-- OPTIONAL CONFIRM CHECKBOX -->
    <div *ngIf="data.requireConfirmation" class="checkbox-wrapper">
      <mat-checkbox [(ngModel)]="isChecked">
        {{ data.confirmationText || 'Ich bestätige diese Aktion' }}
      </mat-checkbox>
    </div>

    <!-- ACTIONS -->
    <div class="dialog-actions">

      <button
        mat-stroked-button
        (click)="onCancel()"
      >
        {{ data.cancelText }}
      </button>

      <button
        mat-flat-button
        color="warn"
        (click)="onConfirm()"
        [disabled]="data.requireConfirmation && !isChecked"
      >
        {{ data.confirmText }}
      </button>

    </div>

  `,
  styles: [`
    :host {
      display: block;
      padding: 1.3rem 1.5rem 1.5rem;
    }

    .dialog-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .header-text {
      h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
      }

      p {
        margin: .3rem 0 0;
        font-size: .9rem;
        color: #64748b;
        line-height: 1.4;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: .6rem;
      margin-top: 1.2rem;

      button {
        min-width: 110px;
        font-weight: 600;
        border-radius: 10px;
      }
    }

    .checkbox-wrapper {
      margin-top: 1rem;
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
      requireConfirmation?: boolean;      // neu: Checkbox optional
      confirmationText?: string;          // optionaler Text für Checkbox
    }
  ) {}

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }

}
