import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CollectionDTO } from '../../model/Collection';
import { HttpService } from '../../service/http.service';

type AddCollectionDialogResult = CollectionDTO | { id: string } | false | undefined;

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
            [class.input-error]="errorMessageKey"
            (ngModelChange)="clearError()"
          />
        </mat-form-field>

        @if (errorMessageKey) {
          <div class="inline-error">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessageKey | translate }}</span>
          </div>
        }

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

    .inline-error {
      display: flex;
      align-items: center;
      gap: .55rem;
      margin-top: .35rem;
      padding: .75rem .85rem;
      border-radius: 12px;
      background: rgba(244, 67, 54, .1);
      color: #b3261e;
      font-weight: 600;
      font-size: .92rem;
    }

    .inline-error mat-icon {
      margin: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
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
  private readonly dialogRef = inject(MatDialogRef<AddCollectionDialogComponent, AddCollectionDialogResult>);
  private readonly service = inject(HttpService);

  schoolName = '';
  isSaving = false;
  errorMessageKey = '';

  get canCreateSchool(): boolean {
    return this.normalizedSchoolName.length > 0;
  }

  closeDialog(): void {
    if (this.isSaving) return;
    this.dialogRef.close(false);
  }

  createSchool(): void {
    if (!this.canCreateSchool || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessageKey = '';
    this.dialogRef.disableClose = true;

    this.service.addCollection(this.normalizedSchoolName).subscribe({
      next: (response: unknown) => {
        const createdId = this.getCreatedCollectionId(response);

        this.isSaving = false;
        this.dialogRef.disableClose = false;

        if (!createdId) {
          this.errorMessageKey = 'dialog.collectionCreateError';
          return;
        }

        if (response && typeof response === 'object') {
          this.dialogRef.close(response as CollectionDTO);
          return;
        }

        this.dialogRef.close({ id: createdId });
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        this.dialogRef.disableClose = false;

        const backendCode = this.extractBackendCode(error);

        if (error.status === 409 || backendCode === 'COLLECTION_NAME_EXISTS') {
          this.errorMessageKey = 'dialog.collectionNameExists';
          return;
        }

        if (backendCode === 'COLLECTION_NAME_EMPTY') {
          this.errorMessageKey = 'dialog.collectionNameEmpty';
          return;
        }

        this.errorMessageKey = 'dialog.collectionCreateError';
      },
    });
  }

  clearError(): void {
    if (this.errorMessageKey) {
      this.errorMessageKey = '';
    }
  }

  private getCreatedCollectionId(response: unknown): string | null {
    if (typeof response === 'string' || typeof response === 'number') {
      const value = String(response).trim();
      return value || null;
    }

    if (response && typeof response === 'object') {
      const item = response as { id?: unknown; collectionId?: unknown };
      const rawId = item.id ?? item.collectionId;

      if (typeof rawId === 'string' || typeof rawId === 'number') {
        const value = String(rawId).trim();
        return value || null;
      }
    }

    return null;
  }

  private extractBackendCode(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') {
      return error.error;
    }

    if (error.error?.code) {
      return error.error.code;
    }

    if (error.error?.message) {
      return error.error.message;
    }

    return '';
  }

  private get normalizedSchoolName(): string {
    return this.schoolName.trim();
  }
}
