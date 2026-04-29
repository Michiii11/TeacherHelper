import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ExampleDTO, ExampleTypeLabels, ExampleTypes } from '../../model/Example';

type ExplorerFolderType = 'examples' | 'tests';

type ExplorerFolder = {
  id: string;
  schoolId: string;
  type: ExplorerFolderType;
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

type ExampleSortKey = 'folder_title' | 'title_asc' | 'title_desc' | 'type_title' | 'newest' | 'oldest';

type PickerOption = {
  value: string;
  label: string;
};

type SortOption = {
  value: ExampleSortKey;
  labelKey: string;
};

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
    TranslateModule,
  ],
  templateUrl: './example-picker-dialog.component.html',
  styleUrl: './example-picker-dialog.component.scss',
})
export class ExamplePickerDialogComponent implements OnInit {
  readonly initiallySelected = new Set<string>();
  readonly workingSelection = new Set<string>();

  search = '';
  selectedFolderId: string | null = null;
  selectedTypes: string[] = [];
  selectedFocuses: string[] = [];
  sortBy: ExampleSortKey = 'folder_title';

  readonly sortOptions: SortOption[] = [
    { value: 'folder_title', labelKey: 'createTest.sort.folderTitle' },
    { value: 'title_asc', labelKey: 'createTest.sort.titleAsc' },
    { value: 'title_desc', labelKey: 'createTest.sort.titleDesc' },
    { value: 'type_title', labelKey: 'createTest.sort.typeTitle' },
    { value: 'newest', labelKey: 'createTest.sort.newest' },
    { value: 'oldest', labelKey: 'createTest.sort.oldest' },
  ];

  private readonly folderPathCache = new Map<string | null, string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExamplePickerDialogData,
    private readonly dialogRef: MatDialogRef<ExamplePickerDialogComponent, ExamplePickerDialogResult>,
    private readonly translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initiallySelected.clear();

    for (const id of this.data.selectedIds ?? []) {
      this.initiallySelected.add(id);
    }
  }

  get orderedFolders(): ExplorerFolder[] {
    return this.exampleFolders.sort((a, b) => this.compareText(this.getFolderPathLabel(a.id), this.getFolderPathLabel(b.id)));
  }

  get availableTypes(): PickerOption[] {
    const typeValues = new Set<string>();

    for (const example of this.examples) {
      if (example.type != null) {
        typeValues.add(String(example.type));
      }
    }

    return [...typeValues]
      .map(value => ({ value, label: this.getTypeLabel(value) }))
      .sort((a, b) => this.compareText(a.label, b.label));
  }

  get availableFocuses(): string[] {
    const focusLabels = new Set<string>();

    for (const example of this.examples) {
      for (const focus of example.focusList ?? []) {
        const label = this.cleanText(focus.label);

        if (label) {
          focusLabels.add(label);
        }
      }
    }

    return [...focusLabels].sort((a, b) => this.compareText(a, b));
  }

  get filteredExamples(): ExampleDTO[] {
    const query = this.normalize(this.search);

    return this.examples
      .filter(example => this.matchesFolderFilter(example))
      .filter(example => this.matchesTypeFilter(example))
      .filter(example => this.matchesFocusFilter(example))
      .filter(example => !query || this.matchesQuery(example, query))
      .sort((a, b) => this.compareExamples(a, b));
  }

  get selectedCount(): number {
    return this.workingSelection.size;
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.selectedTypes.length || this.selectedFocuses.length || this.selectedFolderId !== null || this.search.trim());
  }

  selectFolder(folderId: string | null): void {
    this.selectedFolderId = folderId;
  }

  clearTypes(): void {
    this.selectedTypes = [];
  }

  clearFocuses(): void {
    this.selectedFocuses = [];
  }

  toggleType(type: string): void {
    this.selectedTypes = this.toggleSelectionValue(this.selectedTypes, type);
  }

  toggleFocus(focus: string): void {
    this.selectedFocuses = this.toggleSelectionValue(this.selectedFocuses, focus);
  }

  toggleExample(exampleId: string, checked: boolean): void {
    if (this.isAlreadySelected(exampleId)) {
      return;
    }

    if (checked) {
      this.workingSelection.add(exampleId);
      return;
    }

    this.workingSelection.delete(exampleId);
  }

  toggleExampleRow(exampleId: string): void {
    if (!this.isAlreadySelected(exampleId)) {
      this.toggleExample(exampleId, !this.isWorkingSelected(exampleId));
    }
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

  getExampleTitle(example: ExampleDTO): string {
    const instruction = this.cleanText(example.instruction);
    const question = this.cleanText(example.question);

    return instruction || question || `Example #${example.id}`;
  }

  getTypeLabel(type: ExampleTypes | string | null | undefined): string {
    if (type == null) {
      return '—';
    }

    const typeKey = String(type) as ExampleTypes;
    const translationKey = ExampleTypeLabels[typeKey];

    return translationKey ? this.translate.instant(translationKey) : this.prettyEnumLabel(String(type));
  }

  getExampleFolderPathLabel(example: ExampleDTO): string {
    return this.getFolderPathLabel(this.getExampleFolderId(example));
  }

  getFolderPathLabel(folderId: string | null): string {
    if (this.folderPathCache.has(folderId)) {
      return this.folderPathCache.get(folderId)!;
    }

    const rootLabel = this.translate.instant('school.root');

    if (folderId === null) {
      this.folderPathCache.set(folderId, rootLabel);
      return rootLabel;
    }

    const path = this.buildFolderPath(folderId, rootLabel);
    this.folderPathCache.set(folderId, path);

    return path;
  }

  confirm(): void {
    this.dialogRef.close({ selectedIds: [...this.workingSelection] });
  }

  close(): void {
    this.dialogRef.close();
  }

  private get examples(): ExampleDTO[] {
    return this.data.examples ?? [];
  }

  private get folders(): ExplorerFolder[] {
    return this.data.folders ?? [];
  }

  private get exampleFolders(): ExplorerFolder[] {
    return this.folders.filter(folder => folder.type === 'examples');
  }

  private getExampleFolderId(example: ExampleDTO): string | null {
    return example.folder?.id ?? null;
  }

  private matchesFolderFilter(example: ExampleDTO): boolean {
    return this.selectedFolderId === null || this.getExampleFolderId(example) === this.selectedFolderId;
  }

  private matchesTypeFilter(example: ExampleDTO): boolean {
    return !this.selectedTypes.length || this.selectedTypes.includes(String(example.type));
  }

  private matchesFocusFilter(example: ExampleDTO): boolean {
    if (!this.selectedFocuses.length) {
      return true;
    }

    const exampleFocuses = new Set((example.focusList ?? []).map(focus => this.normalize(focus.label ?? '')));

    return this.selectedFocuses.some(focus => exampleFocuses.has(this.normalize(focus)));
  }

  private matchesQuery(example: ExampleDTO, query: string): boolean {
    const focusLabels = (example.focusList ?? []).map(focus => focus.label ?? '').join(' ');

    const haystack = this.normalize([
      example.question,
      example.instruction,
      example.admin?.username ?? '',
      String(example.id),
      this.getTypeLabel(example.type),
      focusLabels,
      this.getExampleFolderPathLabel(example),
    ].join(' '));

    return haystack.includes(query);
  }

  private compareExamples(a: ExampleDTO, b: ExampleDTO): number {
    const titleA = this.getExampleTitle(a);
    const titleB = this.getExampleTitle(b);
    const folderA = this.getExampleFolderPathLabel(a);
    const folderB = this.getExampleFolderPathLabel(b);
    const typeA = this.getTypeLabel(a.type);
    const typeB = this.getTypeLabel(b.type);

    switch (this.sortBy) {
      case 'title_asc':
        return this.compareText(titleA, titleB) || this.compareText(folderA, folderB);
      case 'title_desc':
        return this.compareText(titleB, titleA) || this.compareText(folderA, folderB);
      case 'type_title':
        return this.compareText(typeA, typeB) || this.compareText(titleA, titleB) || this.compareText(folderA, folderB);
      case 'newest':
        return this.compareDatesDesc(a, b) || this.compareText(titleA, titleB) || this.compareText(folderA, folderB);
      case 'oldest':
        return this.compareDatesAsc(a, b) || this.compareText(titleA, titleB) || this.compareText(folderA, folderB);
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
    const value = (example as ExampleDTO & { updatedAt?: string; createdAt?: string }).updatedAt
      ?? (example as ExampleDTO & { updatedAt?: string; createdAt?: string }).createdAt
      ?? '';
    const timestamp = Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private buildFolderPath(folderId: string, rootLabel: string): string {
    const crumbs: string[] = [];
    const visitedFolderIds = new Set<string>();
    let current = this.folders.find(folder => folder.id === folderId) ?? null;

    while (current && !visitedFolderIds.has(current.id)) {
      visitedFolderIds.add(current.id);
      crumbs.unshift(current.name);
      current = current.parentId ? this.folders.find(folder => folder.id === current?.parentId) ?? null : null;
    }

    return crumbs.length ? [rootLabel, ...crumbs].join(' / ') : rootLabel;
  }

  private toggleSelectionValue(values: string[], value: string): string[] {
    return values.includes(value)
      ? values.filter(current => current !== value)
      : [...values, value];
  }

  private prettyEnumLabel(value: string): string {
    return value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private cleanText(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private normalize(value: string): string {
    return this.cleanText(value).toLowerCase();
  }
}
