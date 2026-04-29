import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-add-school-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    TranslatePipe
  ],
  template: `
    <div class="dialog-header">
      <div class="title-icon" aria-hidden="true">
        <mat-icon>school</mat-icon>
      </div>

      <div>
        <h2>{{ 'home.createSchool' | translate }}</h2>
        <p>{{ 'dialog.createSchoolSubtitle' | translate }}</p>
      </div>
    </div>

    <form class="dialog-form" (ngSubmit)="createSchool()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'dialog.schoolName' | translate }}</mat-label>
        <input
          matInput
          autofocus
          required
          name="schoolName"
          [(ngModel)]="schoolName"
          [placeholder]="'dialog.schoolPlaceholder' | translate"
        />
      </mat-form-field>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" (click)="closeDialog()">
          {{ 'common.cancel' | translate }}
        </button>

        <button mat-flat-button color="primary" type="submit" [disabled]="!canCreateSchool">
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
  `]
})
export class AddSchoolDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AddSchoolDialogComponent, string | undefined>);

  schoolName = '';

  get canCreateSchool(): boolean {
    return this.normalizedSchoolName.length > 0;
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  createSchool(): void {
    if (!this.canCreateSchool) {
      return;
    }

    this.dialogRef.close(this.normalizedSchoolName);
  }

  private get normalizedSchoolName(): string {
    return this.schoolName.trim();
  }
}
