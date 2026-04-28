import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ExampleDTO, ExampleTypeLabels, ExampleTypes } from '../../model/Example';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

type ExplorerFolder = {
  id: string;
  schoolId: string;
  type: 'examples' | 'tests';
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamplePickerDialogData = {
  examples: ExampleDTO[];
  selectedIds: string[];
  folders: ExplorerFolder[];
};

export type ExamplePickerDialogResult = {
  selectedIds: string[];
};

type ExampleSortKey =
  | 'folder_title'
  | 'title_asc'
  | 'title_desc'
  | 'type_title'
  | 'newest'
  | 'oldest';

@Component({
  selector: 'app-example-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    TranslateModule
  ],
  templateUrl: './example-picker-dialog.component.html',
  styleUrl: './example-picker-dialog.component.scss',
})
export class ExamplePickerDialogComponent implements OnInit {
  readonly workingSelection = new Set<string>();
  readonly initiallySelected = new Set<string>();

  search = '';
  selectedFolderId: string | null = null;
  selectedTypes: string[] = [];
  selectedFocuses: string[] = [];
  sortBy: ExampleSortKey = 'folder_title';

  readonly sortOptions: { value: ExampleSortKey; label: string }[] = [
    { value: 'folder_title', label: 'createTest.sort.folderTitle' },
    { value: 'title_asc', label: 'createTest.sort.titleAsc' },
    { value: 'title_desc', label: 'createTest.sort.titleDesc' },
    { value: 'type_title', label: 'createTest.sort.typeTitle' },
    { value: 'newest', label: 'createTest.sort.newest' },
    { value: 'oldest', label: 'createTest.sort.oldest' },
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExamplePickerDialogData,
    private readonly dialogRef: MatDialogRef<ExamplePickerDialogComponent, ExamplePickerDialogResult>,
    private readonly translate: TranslateService
  ) {}

  ngOnInit(): void {
    for (const id of this.data.selectedIds ?? []) {
      this.initiallySelected.add(id);
    }
  }

  get orderedFolders(): ExplorerFolder[] {
    return [...(this.data.folders ?? [])]
      .filter(folder => folder.type === 'examples')
      .sort((a, b) =>
        this.getFolderPathLabel(a.id).localeCompare(
          this.getFolderPathLabel(b.id),
          undefined,
          { sensitivity: 'base' }
        )
      );
  }

  get availableTypes(): { value: string; label: string }[] {
    const values = new Set<string>();

    for (const example of this.data.examples ?? []) {
      if (example?.type != null) {
        values.add(String(example.type));
      }
    }

    return [...values]
      .sort((a, b) =>
        this.getTypeLabel(a).localeCompare(this.getTypeLabel(b), undefined, {
          sensitivity: 'base',
        })
      )
      .map(value => ({ value, label: this.getTypeLabel(value) }));
  }

  get availableFocuses(): string[] {
    const focuses = new Set<string>();

    for (const example of this.data.examples ?? []) {
      for (const focus of example.focusList ?? []) {
        const label = (focus.label ?? '').trim();
        if (label) {
          focuses.add(label);
        }
      }
    }

    return [...focuses].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }

  get filteredExamples(): ExampleDTO[] {
    const query = this.normalize(this.search);

    return [...(this.data.examples ?? [])]
      .filter(example => {
        if (this.selectedFolderId !== null && (example.folder.id ?? null) !== this.selectedFolderId) {
          return false;
        }

        if (this.selectedTypes.length && !this.selectedTypes.includes(String(example.type))) {
          return false;
        }

        if (this.selectedFocuses.length) {
          const focusLabels = (example.focusList ?? []).map(f =>
            this.normalize(f.label ?? '')
          );

          if (!this.selectedFocuses.some(focus => focusLabels.includes(this.normalize(focus)))) {
            return false;
          }
        }

        if (!query) {
          return true;
        }

        return this.matchesQuery(example, query);
      })
      .sort((a, b) => this.compareExamples(a, b));
  }

  get selectedCount(): number {
    return this.workingSelection.size;
  }

  isAlreadySelected(exampleId: string): boolean {
    return this.initiallySelected.has(exampleId);
  }

  isWorkingSelected(exampleId: string): boolean {
    return this.workingSelection.has(exampleId);
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes.includes(type);
  }

  isFocusSelected(focus: string): boolean {
    return this.selectedFocuses.includes(focus);
  }

  toggleExample(exampleId: string, checked: boolean): void {
    if (this.isAlreadySelected(exampleId)) {
      return;
    }

    if (checked) {
      this.workingSelection.add(exampleId);
    } else {
      this.workingSelection.delete(exampleId);
    }
  }

  toggleType(type: string): void {
    this.selectedTypes = this.selectedTypes.includes(type)
      ? this.selectedTypes.filter(t => t !== type)
      : [...this.selectedTypes, type];
  }

  toggleFocus(focus: string): void {
    this.selectedFocuses = this.selectedFocuses.includes(focus)
      ? this.selectedFocuses.filter(f => f !== focus)
      : [...this.selectedFocuses, focus];
  }

  clearTypes(): void {
    this.selectedTypes = [];
  }

  clearFocuses(): void {
    this.selectedFocuses = [];
  }

  getExampleTitle(example: ExampleDTO): string {
    const instruction = (example.instruction ?? '').trim();
    const question = (example.question ?? '').trim();
    return instruction || question || `Example #${example.id}`;
  }

  getTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    const key = ExampleTypeLabels[String(type) as ExampleTypes];

    return key
      ? this.translate.instant(key)
      : this.prettyEnumLabel(String(type));
  }

  getFolderPathLabel(folderId: string | null): string {
    const rootLabel = this.translate.instant('school.root');

    if (folderId === null) {
      return rootLabel;
    }

    const crumbs: string[] = [];
    const folders = this.data.folders ?? [];
    let current = folders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      crumbs.unshift(current.name);
      current = folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return crumbs.length ? [rootLabel, ...crumbs].join(' / ') : rootLabel;
  }

  confirm(): void {
    this.dialogRef.close({ selectedIds: [...this.workingSelection] });
  }

  close(): void {
    this.dialogRef.close();
  }

  private compareExamples(a: ExampleDTO, b: ExampleDTO): number {
    const titleA = this.getExampleTitle(a);
    const titleB = this.getExampleTitle(b);
    const folderA = this.getFolderPathLabel(a.folder.id ?? null);
    const folderB = this.getFolderPathLabel(b.folder.id ?? null);
    const typeA = this.getTypeLabel(a.type);
    const typeB = this.getTypeLabel(b.type);

    switch (this.sortBy) {
      case 'title_asc':
        return this.compareText(titleA, titleB) || this.compareText(folderA, folderB);

      case 'title_desc':
        return this.compareText(titleB, titleA) || this.compareText(folderA, folderB);

      case 'type_title':
        return (
          this.compareText(typeA, typeB) ||
          this.compareText(titleA, titleB) ||
          this.compareText(folderA, folderB)
        );

      case 'newest':
        return (
          this.compareDatesDesc(a, b) ||
          this.compareText(titleA, titleB) ||
          this.compareText(folderA, folderB)
        );

      case 'oldest':
        return (
          this.compareDatesAsc(a, b) ||
          this.compareText(titleA, titleB) ||
          this.compareText(folderA, folderB)
        );

      case 'folder_title':
      default:
        return this.compareText(folderA, folderB) || this.compareText(titleA, titleB);
    }
  }

  private compareText(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  }

  private compareDatesDesc(a: ExampleDTO, b: ExampleDTO): number {
    return this.getSortTimestamp(b) - this.getSortTimestamp(a);
  }

  private compareDatesAsc(a: ExampleDTO, b: ExampleDTO): number {
    return this.getSortTimestamp(a) - this.getSortTimestamp(b);
  }

  private getSortTimestamp(example: ExampleDTO): number {
    const value = (example as any).updatedAt ?? (example as any).createdAt ?? '';
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private matchesQuery(example: ExampleDTO, query: string): boolean {
    const focusLabels = (example.focusList ?? []).map(focus => focus.label ?? '').join(' ');

    const haystack = this.normalize(
      [
        example.question,
        example.instruction,
        example.admin?.username ?? '',
        String(example.id),
        this.getTypeLabel(example.type),
        focusLabels,
        this.getFolderPathLabel(example.folder.id ?? null),
      ].join(' ')
    );

    return haystack.includes(query);
  }

  private prettyEnumLabel(value: string): string {
    return value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private normalize(value: string): string {
    return (value ?? '').toString().trim().toLowerCase();
  }
}
