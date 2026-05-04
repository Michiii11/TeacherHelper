import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-add-collection-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatProgressBar,
    MatProgressSpinner,
    TranslatePipe
  ],
  template: `
    <div class="dialog-content" [class.saving]="isSaving">
      @if (isSaving) {
        <div class="loading-overlay">
          <mat-spinner diameter="42"></mat-spinner>
        </div>
      }

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
            [disabled]="isSaving"
          />
        </mat-form-field>

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="closeDialog()" [disabled]="isSaving">
            {{ 'common.cancel' | translate }}
          </button>

          <button mat-flat-button color="primary" type="submit" [disabled]="isSaving || !canCreateSchool">
            <mat-icon>{{ isSaving ? 'hourglass_top' : 'save' }}</mat-icon>
            {{ isSaving ? ('common.saving' | translate) : ('common.save' | translate) }}
          </button>
        </div>

        @if (isSaving) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }
      </form>
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

    mat-icon {
      margin-right: .35rem;
    }
  `]
})
export class AddCollectionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AddCollectionDialogComponent, string | undefined>);

  schoolName = '';
  isSaving = false;

  get canCreateSchool(): boolean {
    return this.normalizedSchoolName.length > 0;
  }

  closeDialog(): void {
    if (this.isSaving) return;
    this.dialogRef.close();
  }

  createSchool(): void {
    if (!this.canCreateSchool || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.dialogRef.disableClose = true;

    this.dialogRef.close(this.normalizedSchoolName);
  }

  private get normalizedSchoolName(): string {
    return this.schoolName.trim();
  }
}
