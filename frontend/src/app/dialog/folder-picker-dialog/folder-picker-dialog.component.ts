import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

export interface FolderPickerItem {
  id: string;
  name: string;
  path: string;
  disabled?: boolean;
}

export interface FolderPickerDialogData {
  title: string;
  subtitle?: string;
  rootLabel: string;
  currentFolderId: string | null;
  folders: FolderPickerItem[];
}

@Component({
  selector: 'app-folder-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe
  ],
  template: `
    <div class="dialog-header">
      <div class="title-icon">
        <mat-icon>drive_file_move</mat-icon>
      </div>

      <div>
        <h2>{{ data.title }}</h2>
        <p *ngIf="data.subtitle">{{ data.subtitle }}</p>
      </div>
    </div>

    <mat-form-field appearance="outline" class="full-width search-field">
      <input
        matInput
        [ngModel]="search()"
        (ngModelChange)="search.set($event ?? '')"
        [placeholder]="'school.folderPickerSearch' | translate"
      >
    </mat-form-field>

    <div class="folder-list">
      <button
        type="button"
        class="folder-option"
        [class.selected]="selectedFolderId() === null"
        (click)="select(null)"
      >
        <div class="folder-option-main">
          <mat-icon>home</mat-icon>
          <div class="folder-option-text">
            <span class="folder-name">{{ data.rootLabel }}</span>
            <span class="folder-path">{{ data.rootLabel }}</span>
          </div>
        </div>

        <mat-icon *ngIf="selectedFolderId() === null">check_circle</mat-icon>
      </button>

      <button
        type="button"
        class="folder-option"
        *ngFor="let folder of filteredFolders()"
        [disabled]="folder.disabled"
        [class.selected]="selectedFolderId() === folder.id"
        (click)="select(folder.id)"
      >
        <div class="folder-option-main">
          <mat-icon>folder</mat-icon>
          <div class="folder-option-text">
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-path">{{ folder.path }}</span>
          </div>
        </div>

        <mat-icon *ngIf="selectedFolderId() === folder.id">check_circle</mat-icon>
      </button>
    </div>

    <div class="dialog-actions">
      <button mat-stroked-button type="button" (click)="close()">
        {{ 'common.cancel' | translate }}
      </button>

      <button mat-flat-button color="primary" type="button" (click)="confirm()">
        {{ 'school.moveConfirm' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.4rem 1.5rem 1.6rem;
    }

    .full-width {
      width: 100%;
    }

    .search-field {
      margin-bottom: .5rem;
    }

    .folder-list {
      display: flex;
      flex-direction: column;
      gap: .55rem;
      margin-top: .25rem;
      max-height: 50vh;
      overflow: auto;
      padding-right: .1rem;
    }

    .folder-option {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      text-align: left;
      margin-top: .1rem;
      padding: .85rem 1rem;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      transition: .18s ease;
    }

    .folder-option:hover:not(:disabled) {
      border-color: var(--primary);
      background: var(--surface-2);
      transform: translateY(-1px);
    }

    .folder-option.selected {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 10%, var(--surface));
    }

    .folder-option:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .folder-option-main {
      display: flex;
      align-items: flex-start;
      gap: .8rem;
      min-width: 0;
    }

    .folder-option-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .folder-name {
      font-weight: 600;
      color: var(--text);
    }

    .folder-path {
      font-size: .84rem;
      color: var(--text-subtle);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: .65rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
  `]
})
export class FolderPickerDialogComponent {
  search = signal('');
  selectedFolderId = signal<string | null>(null);

  filteredFolders = computed(() => {
    const value = this.search().trim().toLowerCase();

    if (!value) {
      return this.data.folders;
    }

    return this.data.folders.filter(folder =>
      folder.name.toLowerCase().includes(value) ||
      folder.path.toLowerCase().includes(value)
    );
  });

  constructor(
    public dialogRef: MatDialogRef<FolderPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FolderPickerDialogData
  ) {
    this.selectedFolderId.set(this.data.currentFolderId);
  }

  select(folderId: string | null): void {
    this.selectedFolderId.set(folderId);
  }

  close(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    this.dialogRef.close(this.selectedFolderId());
  }
}
