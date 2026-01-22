import { Component } from '@angular/core';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-add-school-dialog',
  standalone: true,
  imports: [
    MatFormField,
    MatInput,
    FormsModule,
    MatButton,
    MatLabel,
    MatIcon
  ],
  template: `
    <!-- HEADER -->
    <div class="dialog-header">
      <div class="icon-wrapper">
        <mat-icon>school</mat-icon>
      </div>
      <div>
        <h2>Neue Schule</h2>
        <p>Lege eine neue Schule in deinem System an</p>
      </div>
    </div>

    <!-- CONTENT -->
    <form (ngSubmit)="onCreate()" class="dialog-form">

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Schulname</mat-label>
        <input
          matInput
          [(ngModel)]="schoolName"
          name="schoolName"
          required
          autofocus
          placeholder="z.B. HTL Wien West"
        />
      </mat-form-field>

      <!-- ACTIONS -->
      <div class="dialog-actions">

        <button
          mat-stroked-button
          type="button"
          (click)="onCancel()"
        >
          Abbrechen
        </button>

        <button
          mat-flat-button
          color="primary"
          type="submit"
          [disabled]="!schoolName"
        >
          Erstellen
        </button>

      </div>

    </form>
  `,
  styles: [`

/* =========================
   DIALOG CONTAINER
========================= */

:host {
  display: block;
  padding: 1.4rem 1.5rem 1.6rem;
}

/* =========================
   HEADER
========================= */

.dialog-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.2rem;

  h2 {
    margin: 0;
    font-weight: 700;
    font-size: 1.2rem;
  }

  p {
    margin: .2rem 0 0;
    font-size: .85rem;
    color: #64748b;
  }
}

.icon-wrapper {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg,#2563eb,#1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;

  mat-icon {
    font-size: 22px;
  }
}

/* =========================
   FORM
========================= */

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.full-width {
  width: 100%;
}

/* =========================
   ACTIONS
========================= */

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  margin-top: .5rem;

  button {
    border-radius: 10px;
    font-weight: 600;
    min-width: 110px;
  }
}

.mat-mdc-dialog-container {
  border-radius: 18px !important;
}

/* =========================
   MATERIAL OVERRIDES
========================= */

::ng-deep .mat-mdc-text-field-wrapper {
  border-radius: 12px !important;
}

  `]
})
export class AddSchoolDialogComponent {

  schoolName = '';

  constructor(private dialogRef: MatDialogRef<AddSchoolDialogComponent>) {}

  onCancel() {
    this.dialogRef.close();
  }

  onCreate() {
    if (this.schoolName) {
      this.dialogRef.close(this.schoolName);
    }
  }

}
