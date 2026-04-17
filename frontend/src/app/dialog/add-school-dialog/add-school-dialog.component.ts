import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-add-school-dialog',
  standalone: true,
  imports: [
    MatFormField,
    MatInput,
    FormsModule,
    MatButton,
    MatLabel,
    MatIcon,
    TranslatePipe
  ],
  template: `
    <div class="dialog-header">
      <div class="title-icon">
        <mat-icon>school</mat-icon>
      </div>
      <div>
        <h2>{{ 'home.createSchool' | translate }}</h2>
        <p>{{ 'dialog.createSchoolSubtitle' | translate }}</p>
      </div>
    </div>

    <form (ngSubmit)="onCreate()" class="dialog-form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'dialog.schoolName' | translate }}</mat-label>
        <input
          matInput
          [(ngModel)]="schoolName"
          name="schoolName"
          required
          autofocus
          [placeholder]="'dialog.schoolPlaceholder' | translate"
        />
      </mat-form-field>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="onCancel()">
          {{ 'common.cancel' | translate }}
        </button>

        <button mat-flat-button color="primary" type="submit" [disabled]="!schoolName">
          {{ 'common.save' | translate }}
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
