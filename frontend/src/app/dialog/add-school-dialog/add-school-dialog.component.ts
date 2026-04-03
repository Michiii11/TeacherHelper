import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
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
    <div class="dialog-header">
      <div class="icon-wrapper">
        <mat-icon>school</mat-icon>
      </div>
      <div>
        <h2>Neue Schule</h2>
        <p>Lege eine neue Schule in deinem System an</p>
      </div>
    </div>

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

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="onCancel()">
          Abbrechen
        </button>

        <button mat-flat-button color="primary" type="submit" [disabled]="!schoolName">
          Erstellen
        </button>
      </div>
    </form>
  `,
  styles: [`
      :host {
          display: block;
          padding: 1.4rem 1.5rem 1.6rem;
      }

      .dialog-header {
          display: flex;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1.2rem;

          h2 {
              margin: 0;
              font-weight: 700;
              font-size: 1.2rem;
              color: var(--text);
          }

          p {
              margin: .2rem 0 0;
              font-size: .85rem;
              color: var(--text-soft);
          }
      }

      .icon-wrapper {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
              font-size: 22px;
          }
      }

      .dialog-form {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
      }

      .full-width {
          width: 100%;
      }

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

      .mat-mdc-outlined-button:not(:disabled) {
          color: var(--primary);
          border-color: var(--primary);
      }

      ::ng-deep .mat-mdc-dialog-container {
          border-radius: 18px !important;
      }

      ::ng-deep .mat-mdc-text-field-wrapper {
          border-radius: 12px !important;
          background: var(--input-bg);
      }

      ::ng-deep .mdc-text-field--outlined {
          --mdc-outlined-text-field-outline-color: var(--border);
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
