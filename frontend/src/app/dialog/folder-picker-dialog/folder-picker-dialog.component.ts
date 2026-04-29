import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
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
  templateUrl: './folder-picker-dialog.component.html',
  styleUrl: './folder-picker-dialog.component.scss'
})
export class FolderPickerDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<FolderPickerDialogComponent, string | null | undefined>>(MatDialogRef);
  readonly data = inject<FolderPickerDialogData>(MAT_DIALOG_DATA);

  readonly search = signal('');
  readonly selectedFolderId = signal<string | null>(this.data.currentFolderId);

  readonly filteredFolders = computed(() => {
    const searchTerm = this.normalize(this.search());

    if (!searchTerm) {
      return this.data.folders;
    }

    return this.data.folders.filter(folder => this.matchesSearch(folder, searchTerm));
  });

  updateSearch(value: string | null | undefined): void {
    this.search.set(value ?? '');
  }

  select(folderId: string | null): void {
    this.selectedFolderId.set(folderId);
  }

  isSelected(folderId: string | null): boolean {
    return this.selectedFolderId() === folderId;
  }

  close(): void {
    this.dialogRef.close(undefined);
  }

  confirm(): void {
    this.dialogRef.close(this.selectedFolderId());
  }

  private matchesSearch(folder: FolderPickerItem, searchTerm: string): boolean {
    return this.normalize(folder.name).includes(searchTerm) ||
      this.normalize(folder.path).includes(searchTerm);
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
