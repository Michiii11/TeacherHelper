import { Component } from '@angular/core';
import {
  MatDialogRef
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
       BASE
    ========================= */

    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
      background: transparent;
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
        color: #0f172a;
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

    /* =========================
       MATERIAL BASE
    ========================= */

    ::ng-deep .mat-mdc-dialog-container {
      border-radius: 18px !important;
      background: #ffffff;
    }

    /* Input */
    ::ng-deep .mat-mdc-text-field-wrapper {
      border-radius: 12px !important;
      background: #ffffff;
    }

    ::ng-deep .mdc-text-field--outlined {
      --mdc-outlined-text-field-outline-color: #e2e8f0;
    }

    /* =========================
       🌙 DARK MODE
    ========================= */

    :host-context(.dark-mode) {

      .dialog-header {
        h2 {
          color: #f1f5f9;
        }

        p {
          color: #94a3b8;
        }
      }

    }

    /* Dialog Background */
    :host-context(.dark-mode) ::ng-deep .mat-mdc-dialog-container {
      background: #0f172a;
    }

    /* Input Background */
    :host-context(.dark-mode) ::ng-deep .mat-mdc-text-field-wrapper {
      background: #020617;
    }

    /* Input Text */
    :host-context(.dark-mode) ::ng-deep input {
      color: #e2e8f0 !important;
    }

    /* Label */
    :host-context(.dark-mode) ::ng-deep .mdc-floating-label {
      color: #94a3b8 !important;
    }

    /* Outline */
    :host-context(.dark-mode) ::ng-deep .mdc-text-field--outlined {
      --mdc-outlined-text-field-outline-color: #334155;
    }

    :host-context(.dark-mode) ::ng-deep .mdc-text-field--focused {
      --mdc-outlined-text-field-outline-color: #3b82f6;
    }

    /* Buttons */
    :host-context(.dark-mode) button[mat-stroked-button] {
      border-color: #334155;
      color: #e2e8f0;
    }

    :host-context(.dark-mode) button[mat-stroked-button]:hover {
      background: rgba(148,163,184,0.1);
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
