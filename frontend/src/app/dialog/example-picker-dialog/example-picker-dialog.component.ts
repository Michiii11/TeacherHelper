import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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

type FolderOption = ExplorerFolder & {
  path: string;
  depth: number;
  count: number;
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
    MatButtonToggleModule,
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
  selectedAuthors: string[] = [];
  sortBy: ExampleSortKey = 'folder_title';
  folderSearch = '';
  isSortMenuOpen = false;
  isTypeMenuOpen = false;
  isSearchOpen = false;
  isFolderSearchOpen = false;
  selectionViewMode: 'all' | 'selected' = 'all';

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('folderSearchInput') private folderSearchInput?: ElementRef<HTMLInputElement>;

  readonly sortOptions: SortOption[] = [
    { value: 'folder_title', labelKey: 'createTest.sort.folderTitle' },
    { value: 'title_asc', labelKey: 'createTest.sort.titleAsc' },
    { value: 'title_desc', labelKey: 'createTest.sort.titleDesc' },
    { value: 'type_title', labelKey: 'createTest.sort.typeTitle' },
    { value: 'newest', labelKey: 'createTest.sort.newest' },
    { value: 'oldest', labelKey: 'createTest.sort.oldest' },
  ];

  private readonly titleMaxLength = 25;
  private readonly descriptionMaxLength = 55;
  private readonly folderPathCache = new Map<string | null, string>();

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExamplePickerDialogData,
    private readonly dialogRef: MatDialogRef<ExamplePickerDialogComponent, ExamplePickerDialogResult>,
    private readonly translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initiallySelected.clear();
    this.workingSelection.clear();

    for (const id of this.data.selectedIds ?? []) {
      this.initiallySelected.add(id);
      this.workingSelection.add(id);
    }
  }

  get orderedFolders(): ExplorerFolder[] {
    return this.exampleFolders.sort((a, b) => this.compareText(this.getFolderPathLabel(a.id), this.getFolderPathLabel(b.id)));
  }

  get visibleFolderOptions(): FolderOption[] {
    const query = this.normalize(this.folderSearch);

    return this.orderedFolders
      .map(folder => ({
        ...folder,
        path: this.getFolderPathLabel(folder.id),
        depth: this.getFolderDepth(folder.id),
        count: this.getDirectExampleCount(folder.id),
      }))
      .filter(folder => !query || this.normalize(`${folder.name} ${folder.path}`).includes(query));
  }

  get rootExampleCount(): number {
    return this.selectableExamples.length;
  }

  get folderResultCountLabel(): string {
    const count = this.visibleFolderOptions.length;
    return `${count} ${this.translate.instant('collection.folders')}`;
  }

  get availableTypes(): PickerOption[] {
    const typeValues = new Set<string>();

    for (const example of this.selectableExamples) {
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

    for (const example of this.selectableExamples) {
      for (const focus of example.focusList ?? []) {
        const label = this.cleanText(focus.label);

        if (label) {
          focusLabels.add(label);
        }
      }
    }

    return [...focusLabels].sort((a, b) => this.compareText(a, b));
  }

  get availableAuthors(): string[] {
    const authors = new Set<string>();

    for (const example of this.selectableExamples) {
      const author = this.cleanText(example.admin?.username);

      if (author) {
        authors.add(author);
      }
    }

    return [...authors].sort((a, b) => this.compareText(a, b));
  }

  get activeFilterCount(): number {
    return this.selectedTypes.length + this.selectedFocuses.length + this.selectedAuthors.length;
  }

  get filteredExamples(): ExampleDTO[] {
    const query = this.normalize(this.search);

    return this.selectableExamples
      .filter(example => this.matchesFolderFilter(example))
      .filter(example => this.matchesTypeFilter(example))
      .filter(example => this.matchesFocusFilter(example))
      .filter(example => this.matchesAuthorFilter(example))
      .filter(example => !query || this.matchesQuery(example, query))
      .sort((a, b) => this.compareExamples(a, b));
  }

  get displayedExamples(): ExampleDTO[] {
    if (this.selectionViewMode === 'selected') {
      return this.examples
        .filter(example => this.isWorkingSelected(example.id))
        .sort((a, b) => this.compareExamples(a, b));
    }

    return this.filteredExamples;
  }

  get selectedCount(): number {
    return this.workingSelection.size;
  }

  get typeFilterLabel(): string {
    if (!this.activeFilterCount) {
      return this.translate.instant('common.filter');
    }

    if (!this.selectedTypes.length) {
      return `${this.translate.instant('common.filter')} (${this.activeFilterCount})`;
    }

    if (this.selectedTypes.length === 1) {
      return this.getTypeLabel(this.selectedTypes[0]);
    }

    return `${this.translate.instant('common.type')} (${this.selectedTypes.length})`;
  }


  get activeFilterChips(): Array<{ key: string; label: string; icon: string; action: () => void }> {
    const chips: Array<{ key: string; label: string; icon: string; action: () => void }> = [];

    if (this.selectedFolderId !== null) {
      chips.push({
        key: `folder-${this.selectedFolderId}`,
        label: this.getFolderPathLabel(this.selectedFolderId),
        icon: 'folder',
        action: () => this.selectFolder(null),
      });
    }

    for (const type of this.selectedTypes) {
      chips.push({
        key: `type-${type}`,
        label: this.getTypeLabel(type),
        icon: this.getTypeIcon(type),
        action: () => this.toggleType(type),
      });
    }

    for (const focus of this.selectedFocuses) {
      chips.push({
        key: `focus-${focus}`,
        label: focus,
        icon: 'sell',
        action: () => this.toggleFocus(focus),
      });
    }

    for (const author of this.selectedAuthors) {
      chips.push({
        key: `author-${author}`,
        label: `${this.translate.instant('collection.author')}: ${author}`,
        icon: 'person',
        action: () => this.toggleAuthor(author),
      });
    }

    const query = this.search.trim();
    if (query) {
      chips.push({
        key: 'search',
        label: query,
        icon: 'search',
        action: () => {
          this.search = '';
          this.isSearchOpen = true;
        },
      });
    }


    return chips;
  }

  get currentFolderLabel(): string {
    return this.selectedFolderId === null
      ? ''
      : this.getFolderPathLabel(this.selectedFolderId);
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.selectedTypes.length || this.selectedFocuses.length || this.selectedAuthors.length || this.selectedFolderId !== null || this.search.trim());
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

  clearAuthors(): void {
    this.selectedAuthors = [];
  }

  resetFilters(): void {
    this.selectedTypes = [];
    this.selectedFocuses = [];
    this.selectedAuthors = [];
  }

  toggleSortMenu(): void {
    this.isSortMenuOpen = !this.isSortMenuOpen;
    this.isTypeMenuOpen = false;
  }

  toggleTypeMenu(): void {
    this.isTypeMenuOpen = !this.isTypeMenuOpen;
    this.isSortMenuOpen = false;
  }

  openSearch(): void {
    this.isSearchOpen = true;
    this.isSortMenuOpen = false;
    this.isTypeMenuOpen = false;
    window.setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  openFolderSearch(): void {
    this.isFolderSearchOpen = true;
    window.setTimeout(() => this.folderSearchInput?.nativeElement.focus());
  }

  collapseFolderSearch(): void {
    if (!this.folderSearch.trim()) {
      this.isFolderSearchOpen = false;
    }
  }

  onFolderSearchFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as HTMLElement | null;

    window.setTimeout(() => {
      if (!currentTarget || !nextTarget || !currentTarget.contains(nextTarget)) {
        this.collapseFolderSearch();
      }
    });
  }


  collapseSearch(): void {
    if (!this.search.trim()) {
      this.isSearchOpen = false;
    }
  }

  onSearchFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as HTMLElement | null;

    window.setTimeout(() => {
      if (!currentTarget || !nextTarget || !currentTarget.contains(nextTarget)) {
        this.collapseSearch();
      }
    });
  }

  closeSearch(): void {
    this.search = '';
    this.collapseSearch();
  }

  setSelectionViewMode(value: 'all' | 'selected'): void {
    this.selectionViewMode = value;
  }

  setSort(value: ExampleSortKey): void {
    this.sortBy = value;
    this.isSortMenuOpen = false;
  }

  getSortLabel(value: ExampleSortKey): string {
    const option = this.sortOptions.find(current => current.value === value);
    return option ? this.translate.instant(option.labelKey) : '—';
  }

  toggleType(type: string): void {
    this.selectedTypes = this.toggleSelectionValue(this.selectedTypes, type);
  }

  toggleFocus(focus: string): void {
    this.selectedFocuses = this.toggleSelectionValue(this.selectedFocuses, focus);
  }

  toggleAuthor(author: string): void {
    this.selectedAuthors = this.toggleSelectionValue(this.selectedAuthors, author);
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
    if (this.isAlreadySelected(exampleId)) {
      return;
    }

    this.toggleExample(exampleId, !this.isWorkingSelected(exampleId));
  }

  isAlreadySelected(exampleId: string): boolean {
    return this.initiallySelected.has(exampleId);
  }

  isExampleDisabled(exampleId: string): boolean {
    return this.isAlreadySelected(exampleId);
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

  isAuthorSelected(author: string): boolean {
    return this.selectedAuthors.includes(author);
  }

  getExampleTitle(example: ExampleDTO): string {
    return this.truncateText(this.getExampleTitleFull(example), this.titleMaxLength);
  }

  getExampleTitleFull(example: ExampleDTO): string {
    const instruction = this.cleanText(example.instruction);
    const question = this.cleanText(example.question);

    return instruction || question || `${this.translate.instant('collection.example')} #${example.id}`;
  }

  getExampleDescription(example: ExampleDTO): string {
    return this.truncateText(this.getExampleDescriptionFull(example), this.descriptionMaxLength);
  }

  getExampleDescriptionFull(example: ExampleDTO): string {
    const title = this.getExampleTitleFull(example);
    const question = this.cleanText(example.question);
    const instruction = this.cleanText(example.instruction);
    const description = question && question !== title ? question : instruction && instruction !== title ? instruction : '';

    return description;
  }

  getTypeIcon(type: ExampleTypes | string | null | undefined): string {
    const value = String(type ?? '').toLowerCase();

    if (value.includes('image') || value.includes('bild')) {
      return 'image';
    }

    if (value.includes('audio') || value.includes('sound')) {
      return 'graphic_eq';
    }

    if (value.includes('video')) {
      return 'movie';
    }

    if (value.includes('text') || value.includes('schrift')) {
      return 'notes';
    }

    if (value.includes('code')) {
      return 'code';
    }

    return 'post_add';
  }

  getTypeLabel(type: ExampleTypes | string | null | undefined): string {
    if (type == null) {
      return '—';
    }

    const typeKey = String(type) as ExampleTypes;
    const translationKey = ExampleTypeLabels[typeKey];

    if (!translationKey) {
      return this.prettyEnumLabel(String(type));
    }

    const exerciseTranslationKey = translationKey.replace('exampleTypes.', 'exerciseTypes.');
    const exerciseLabel = this.translate.instant(exerciseTranslationKey);

    if (exerciseLabel && exerciseLabel !== exerciseTranslationKey) {
      return exerciseLabel;
    }

    return this.translate.instant(translationKey);
  }

  getExampleFolderPathLabel(example: ExampleDTO): string {
    return this.getFolderPathLabel(this.getExampleFolderId(example));
  }

  getExampleFolderNameLabel(example: ExampleDTO): string {
    const folderId = this.getExampleFolderId(example);

    if (folderId === null) {
      return '';
    }

    return this.folders.find(folder => folder.id === folderId)?.name ?? this.getFolderPathLabel(folderId);
  }

  getExampleTagsLabel(example: ExampleDTO): string {
    return (example.focusList ?? [])
      .map(focus => this.cleanText(focus.label))
      .filter(Boolean)
      .join(', ');
  }

  getFolderPathLabel(folderId: string | null): string {
    if (this.folderPathCache.has(folderId)) {
      return this.folderPathCache.get(folderId)!;
    }

    if (folderId === null) {
      this.folderPathCache.set(folderId, '');
      return '';
    }

    const path = this.buildFolderPath(folderId);
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

  private get selectableExamples(): ExampleDTO[] {
    return this.examples.filter(example => !this.isAlreadySelected(example.id));
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

  private getDirectExampleCount(folderId: string): number {
    return this.selectableExamples.filter(example => this.getExampleFolderId(example) === folderId).length;
  }

  private getFolderDepth(folderId: string): number {
    let depth = 0;
    const visitedFolderIds = new Set<string>();
    let current = this.folders.find(folder => folder.id === folderId) ?? null;

    while (current?.parentId && !visitedFolderIds.has(current.id)) {
      visitedFolderIds.add(current.id);
      depth += 1;
      current = this.folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return depth;
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

  private matchesAuthorFilter(example: ExampleDTO): boolean {
    if (!this.selectedAuthors.length) {
      return true;
    }

    const author = this.normalize(example.admin?.username ?? '');

    return this.selectedAuthors.some(selectedAuthor => author === this.normalize(selectedAuthor));
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
    const titleA = this.getExampleTitleFull(a);
    const titleB = this.getExampleTitleFull(b);
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

  private buildFolderPath(folderId: string): string {
    const crumbs: string[] = [];
    const visitedFolderIds = new Set<string>();
    let current = this.folders.find(folder => folder.id === folderId) ?? null;

    while (current && !visitedFolderIds.has(current.id)) {
      visitedFolderIds.add(current.id);
      crumbs.unshift(current.name);
      current = current.parentId ? this.folders.find(folder => folder.id === current?.parentId) ?? null : null;
    }

    return crumbs.join(' / ');
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

  private truncateText(value: string, maxLength: number): string {
    const text = this.cleanText(value);

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  private normalize(value: string): string {
    return this.cleanText(value).toLowerCase();
  }
}
