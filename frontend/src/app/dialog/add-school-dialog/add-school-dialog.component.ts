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
      <div class="title-icon">
        <mat-icon>school</mat-icon>
      </div>
      <div>
        <h2>Neue Sammlung</h2>
        <p>Lege eine neue Sammlung in deinem System an</p>
      </div>
    </div>

    <form (ngSubmit)="onCreate()" class="dialog-form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Sammlungsname</mat-label>
        <input
          matInput
          [(ngModel)]="schoolName"
          name="schoolName"
          required
          autofocus
          placeholder="z.B. HTL 1 - Deutsch"
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
