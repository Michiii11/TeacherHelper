import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    MatButton,
  ],
  template: `

    <!-- HEADER -->
    <div class="dialog-header">
      <div class="header-text">
        <h2>{{ data.title }}</h2>
        <p>{{ data.message }}</p>
      </div>

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

/* =========================
   HEADER
========================= */

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

/* =========================
   ICON
========================= */

.icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;

  display: flex;
  align-items: center;
  justify-content: center;

  mat-icon {
    font-size: 22px;
  }
}

/* Warning variant */

.icon-wrapper.warn {
  background: rgba(239,68,68,.12);
  color: #dc2626;
}

/* =========================
   ACTIONS
========================= */

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

  `]
})
export class ConfirmDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
    }
  ) {}

  onConfirm() {
    this.dialogRef.close(true);
  }

  onCancel() {
    this.dialogRef.close(false);
  }

}
