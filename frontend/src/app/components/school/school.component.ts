import { Component, HostListener, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus } from '../../model/Example';
import { TestOverviewDTO } from '../../model/Test';
import { UserDTO } from '../../model/User';

import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatButtonModule, MatIconButton, MatMiniFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { CreateExampleComponent } from '../../dialog/create-example/create-example.component';
import { CreateTestComponent } from '../../dialog/create-test/create-test.component';
import { TestPreviewComponent } from '../../dialog/test-preview/test-preview.component';
import { ExamplePreviewComponent } from '../../dialog/example-preview/example-preview.component';
import { SchoolSettingsComponent } from '../../dialog/school-settings/school-settings.component';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import {MatFormField, MatOption, MatSelect} from '@angular/material/select'

type ExplorerTab = 'examples' | 'tests';
type SortOption = 'nameAsc' | 'nameDesc' | 'createdDesc' | 'createdAsc' | 'authorAsc';
type ViewMode = 'grid' | 'compact';

interface ExplorerFolder {
  id: string;
  schoolId: string;
  type: ExplorerTab;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExplorerExample extends ExampleOverviewDTO {
  createdAt?: string;
  updatedAt?: string;
}

interface ExplorerTest extends TestOverviewDTO {
  createdAt?: string;
  updatedAt?: string;
}

interface DraggedExplorerItem {
  type: ExplorerTab;
  itemId: number;
}

@Component({
  selector: 'app-school',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatButtonModule,
    MatIcon,
    MatIconButton,
    TranslatePipe,
    MatSelect,
    MatOption,
    MatFormField
  ],
  templateUrl: './school.component.html',
  styleUrl: './school.component.scss'
})
export class SchoolComponent implements OnInit {
  service = inject(HttpService);
  dialog = inject(MatDialog);

  school: SchoolDTO = {} as SchoolDTO;
  schoolId: string | null = null;

  currentUserId = -1;
  menuOpen = false;

  activeTab: ExplorerTab = 'examples';

  examples: ExplorerExample[] = [];
  tests: ExplorerTest[] = [];

  exampleFolders: ExplorerFolder[] = [];
  testFolders: ExplorerFolder[] = [];

  selectedExampleFolderId: string | null = null;
  selectedTestFolderId: string | null = null;

  exampleSearch = '';
  testSearch = '';

  exampleSort: SortOption = 'nameAsc';
  testSort: SortOption = 'nameAsc';

  selectedExampleTypes: string[] = [];
  selectedExampleFocuses: string[] = [];
  selectedExampleAuthors: string[] = [];
  selectedTestAuthors: string[] = [];

  openFilterMenu: 'exampleTypes' | 'exampleFocuses' | 'exampleAuthors' | 'testAuthors' | null = null;

  exampleViewMode: ViewMode = 'grid';
  testViewMode: ViewMode = 'grid';

  draggedItem: DraggedExplorerItem | null = null;
  dropTarget: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.route.paramMap.subscribe(params => {
      this.schoolId = params.get('id');

      if (this.schoolId) {
        localStorage.setItem('lastViewedSchoolId', this.schoolId);
        this.loadSchool();
        this.loadFolders();
        this.loadExamples();
        this.loadTests();
      }
    });
  }

  ngOnInit(): void {
    this.service.getUserId().subscribe(id => {
      this.currentUserId = id as number;
    });
  }

  get isAdmin(): boolean {
    return this.currentUserId === this.school?.admin?.id;
  }

  get currentFolders(): ExplorerFolder[] {
    return this.activeTab === 'examples' ? this.exampleFolders : this.testFolders;
  }

  get selectedFolderId(): string | null {
    return this.activeTab === 'examples' ? this.selectedExampleFolderId : this.selectedTestFolderId;
  }

  get currentFolder(): ExplorerFolder | null {
    return this.currentFolders.find(folder => folder.id === this.selectedFolderId) ?? null;
  }

  get parentFolder(): ExplorerFolder | null {
    if (!this.currentFolder?.parentId) {
      return null;
    }

    return this.currentFolders.find(folder => folder.id === this.currentFolder?.parentId) ?? null;
  }

  get currentBreadcrumbs(): ExplorerFolder[] {
    return this.buildBreadcrumbs(this.currentFolders, this.selectedFolderId);
  }

  get currentChildFolders(): ExplorerFolder[] {
    return this.getChildFolders(this.currentFolders, this.selectedFolderId);
  }

  get activeSearch(): string {
    return this.activeTab === 'examples' ? this.exampleSearch : this.testSearch;
  }

  get currentViewMode(): ViewMode {
    return this.activeTab === 'examples' ? this.exampleViewMode : this.testViewMode;
  }

  get isSearching(): boolean {
    return this.activeSearch.trim().length > 0;
  }

  get activeFilterCount(): number {
    if (this.activeTab === 'examples') {
      return [
        this.exampleSearch.trim(),
        this.selectedExampleTypes.length,
        this.selectedExampleFocuses.length,
        this.selectedExampleAuthors.length,
        this.exampleSort !== 'nameAsc'
      ].filter(Boolean).length;
    }

    return [
      this.testSearch.trim(),
      this.selectedTestAuthors.length,
      this.testSort !== 'nameAsc'
    ].filter(Boolean).length;
  }

  get availableExampleTypes(): { value: string; label: string }[] {
    const values = Object.values(ExampleTypes).filter(v => typeof v !== 'number') as string[];
    return values.map(value => ({
      value,
      label: this.getExampleTypeLabel(value)
    }));
  }

  get availableExampleFocuses(): string[] {
    const values = new Set<string>();

    for (const example of this.examples) {
      for (const focus of example.focusList ?? []) {
        const label = (focus.label ?? '').trim();
        if (label) {
          values.add(label);
        }
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  get availableExampleAuthors(): string[] {
    const values = new Set<string>();

    for (const example of this.examples) {
      const author = (example.adminUsername ?? '').trim();
      if (author) {
        values.add(author);
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  get availableTestAuthors(): string[] {
    const values = new Set<string>();

    for (const test of this.tests) {
      const author = (test.adminUsername ?? '').trim();
      if (author) {
        values.add(author);
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  get filteredExamples(): ExplorerExample[] {
    let items = this.isSearching
      ? [...this.examples]
      : this.examples.filter(item => (item.folderId ?? null) === this.selectedExampleFolderId);

    const search = this.exampleSearch.trim().toLowerCase();
    if (search) {
      items = items.filter(item =>
        (item.question ?? '').toLowerCase().includes(search) ||
        (item.instruction ?? '').toLowerCase().includes(search) ||
        (item.adminUsername ?? '').toLowerCase().includes(search) ||
        (item.focusList ?? []).some(f => (f.label ?? '').toLowerCase().includes(search)) ||
        this.getExampleTypeLabel(item.type).toLowerCase().includes(search) ||
        this.getFolderPathLabel(item.folderId ?? null, 'examples').toLowerCase().includes(search)
      );
    }

    if (this.selectedExampleTypes.length) {
      items = items.filter(item => this.selectedExampleTypes.includes(String(item.type)));
    }

    if (this.selectedExampleFocuses.length) {
      const selected = this.selectedExampleFocuses.map(value => value.toLowerCase());
      items = items.filter(item =>
        (item.focusList ?? []).some(f => selected.includes((f.label ?? '').toLowerCase()))
      );
    }

    if (this.selectedExampleAuthors.length) {
      items = items.filter(item => this.selectedExampleAuthors.includes(item.adminUsername ?? ''));
    }

    return this.sortItems(items, this.exampleSort, item => item.question ?? '', item => item.adminUsername ?? '');
  }

  get filteredTests(): ExplorerTest[] {
    let items = this.isSearching
      ? [...this.tests]
      : this.tests.filter(item => (item.folderId ?? null) === this.selectedTestFolderId);

    const search = this.testSearch.trim().toLowerCase();
    if (search) {
      items = items.filter(item =>
        (item.name ?? '').toLowerCase().includes(search) ||
        String(item.amountOfQuestions ?? '').includes(search) ||
        (item.adminUsername ?? '').toLowerCase().includes(search) ||
        this.getFolderPathLabel(item.folderId ?? null, 'tests').toLowerCase().includes(search)
      );
    }

    if (this.selectedTestAuthors.length) {
      items = items.filter(item => this.selectedTestAuthors.includes(item.adminUsername ?? ''));
    }

    return this.sortItems(items, this.testSort, item => item.name ?? '', item => item.adminUsername ?? '');
  }

  get visibleFolders(): ExplorerFolder[] {
    const folders = this.currentFolders;

    if (!this.isSearching) {
      return this.currentChildFolders;
    }

    const search = this.activeSearch.trim().toLowerCase();
    return folders
      .filter(folder =>
        folder.name.toLowerCase().includes(search) ||
        this.getFolderPathLabel(folder.id, this.activeTab).toLowerCase().includes(search)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  }

  get totalVisibleItemCount(): number {
    return this.activeTab === 'examples' ? this.filteredExamples.length : this.filteredTests.length;
  }

  get totalVisibleFolderCount(): number {
    return this.visibleFolders.length;
  }

  get currentPathLabel(): string {
    return this.getFolderPathLabel(this.selectedFolderId, this.activeTab);
  }

  private loadSchool(): void {
    if (!this.schoolId) return;

    this.service.getSchoolById(this.schoolId).subscribe(school => {
      this.school = school;
    });
  }

  private loadExamples(): void {
    if (!this.schoolId) return;

    this.service.getExamples(this.schoolId).subscribe(examples => {
      this.examples = (examples as ExplorerExample[]).map(example => ({
        ...example,
        folderId: example.folderId ?? null
      }));
    });
  }

  private loadTests(): void {
    if (!this.schoolId) return;

    this.service.getTests(this.schoolId).subscribe(tests => {
      this.tests = (tests as ExplorerTest[]).map(test => ({
        ...test,
        folderId: test.folderId ?? null
      }));
    });
  }

  private loadFolders(): void {
    if (!this.schoolId) return;

    const local = this.readLocalFolders();

    forkJoin({
      exampleFolders: this.service.getExampleFolders(this.schoolId).pipe(
        catchError(() => of(local.exampleFolders))
      ),
      testFolders: this.service.getTestFolders(this.schoolId).pipe(
        catchError(() => of(local.testFolders))
      )
    }).subscribe(({ exampleFolders, testFolders }) => {
      this.exampleFolders = this.normalizeFolders(exampleFolders, 'examples');
      this.testFolders = this.normalizeFolders(testFolders, 'tests');
      this.saveLocalFolders();
    });
  }

  private normalizeFolders(
    folders: Array<{
      id: string;
      schoolId: string;
      name: string;
      parentId: string | null;
      createdAt: string;
      updatedAt: string;
    }>,
    type: ExplorerTab
  ): ExplorerFolder[] {
    return (folders ?? []).map(folder => ({
      ...folder,
      type,
      parentId: folder.parentId ?? null
    }));
  }

  private sortItems<T>(
    items: T[],
    sort: SortOption,
    getName: (item: T) => string,
    getAuthor: (item: T) => string
  ): T[] {
    return [...items].sort((a: any, b: any) => {
      switch (sort) {
        case 'nameDesc':
          return getName(b).localeCompare(getName(a), 'de', { sensitivity: 'base' });
        case 'createdDesc':
          return String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? ''));
        case 'createdAsc':
          return String(a.updatedAt ?? a.createdAt ?? '').localeCompare(String(b.updatedAt ?? b.createdAt ?? ''));
        case 'authorAsc':
          return getAuthor(a).localeCompare(getAuthor(b), 'de', { sensitivity: 'base' });
        case 'nameAsc':
        default:
          return getName(a).localeCompare(getName(b), 'de', { sensitivity: 'base' });
      }
    });
  }

  setActiveTab(tab: ExplorerTab): void {
    this.activeTab = tab;
    this.openFilterMenu = null;
    this.clearDropState();
  }

  setCurrentViewMode(mode: ViewMode): void {
    if (this.activeTab === 'examples') {
      this.exampleViewMode = mode;
      return;
    }

    this.testViewMode = mode;
  }

  selectFolder(folderId: string | null): void {
    if (this.activeTab === 'examples') {
      this.selectedExampleFolderId = folderId;
      return;
    }

    this.selectedTestFolderId = folderId;
  }

  openFolder(folder: ExplorerFolder): void {
    this.selectFolder(folder.id);
  }

  navigateToBreadcrumb(folderId: string | null): void {
    this.selectFolder(folderId);
  }

  goToParentFolder(): void {
    this.selectFolder(this.currentFolder?.parentId ?? null);
  }

  getChildFolders(folders: ExplorerFolder[], parentId: string | null): ExplorerFolder[] {
    return folders
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  }

  private buildBreadcrumbs(folders: ExplorerFolder[], folderId: string | null): ExplorerFolder[] {
    if (!folderId) return [];

    const result: ExplorerFolder[] = [];
    let current = folders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      result.unshift(current);
      current = folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return result;
  }

  createFolder(parentId: string | null = this.selectedFolderId): void {
    if (!this.schoolId) return;

    const name = window.prompt('Ordnername eingeben');
    if (!name?.trim()) return;

    const now = new Date().toISOString();
    const folder: ExplorerFolder = {
      id: this.generateId(),
      schoolId: this.schoolId,
      type: this.activeTab,
      name: name.trim(),
      parentId,
      createdAt: now,
      updatedAt: now
    };

    this.addFolderLocal(folder);

    const request = folder.type === 'examples'
      ? this.service.createExampleFolder(this.schoolId, {
        name: folder.name,
        parentId: folder.parentId
      })
      : this.service.createTestFolder(this.schoolId, {
        name: folder.name,
        parentId: folder.parentId
      });

    request.pipe(
      catchError(() => of(folder))
    ).subscribe(createdFolder => {
      this.replaceTemporaryFolder(folder, {
        ...folder,
        ...(createdFolder as Partial<ExplorerFolder>),
        type: folder.type
      });
      this.saveLocalFolders();
    });
  }

  renameFolder(folder: ExplorerFolder, event?: MouseEvent): void {
    event?.stopPropagation();

    const name = window.prompt('Neuen Ordnernamen eingeben', folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;

    const updated: ExplorerFolder = {
      ...folder,
      name: name.trim(),
      updatedAt: new Date().toISOString()
    };

    this.replaceFolderLocal(updated);

    const request = folder.type === 'examples'
      ? this.service.renameExampleFolder(folder.id, { name: updated.name })
      : this.service.renameTestFolder(folder.id, { name: updated.name });

    request.pipe(
      catchError(() => of(updated))
    ).subscribe(folderFromApi => {
      this.replaceFolderLocal({
        ...updated,
        ...(folderFromApi as Partial<ExplorerFolder>),
        type: folder.type
      });
      this.saveLocalFolders();
    });
  }

  deleteFolder(folder: ExplorerFolder, event?: MouseEvent): void {
    event?.stopPropagation();

    const hasChildFolders = this.currentFolders.some(item => item.parentId === folder.id);
    const hasItems = folder.type === 'examples'
      ? this.examples.some(item => (item.folderId ?? null) === folder.id)
      : this.tests.some(item => (item.folderId ?? null) === folder.id);

    if (hasChildFolders || hasItems) {
      window.alert('Der Ordner ist nicht leer. Bitte zuerst Unterordner und Inhalte verschieben oder löschen.');
      return;
    }

    if (!window.confirm(`Ordner "${folder.name}" wirklich löschen?`)) {
      return;
    }

    const previousExampleFolders = [...this.exampleFolders];
    const previousTestFolders = [...this.testFolders];

    this.removeFolderLocal(folder);

    const request = folder.type === 'examples'
      ? this.service.deleteExampleFolder(folder.id)
      : this.service.deleteTestFolder(folder.id);

    request.pipe(
      catchError(() => {
        this.exampleFolders = previousExampleFolders;
        this.testFolders = previousTestFolders;
        this.saveLocalFolders();
        return of(null);
      })
    ).subscribe(() => {
      this.saveLocalFolders();
    });
  }

  moveExampleWithPicker(example: ExplorerExample): void {
    const targetFolderId = this.pickFolderTarget('examples', example.folderId ?? null);
    if (targetFolderId === undefined) return;
    this.moveExampleToFolder(example, targetFolderId);
  }

  moveTestWithPicker(test: ExplorerTest): void {
    const targetFolderId = this.pickFolderTarget('tests', test.folderId ?? null);
    if (targetFolderId === undefined) return;
    this.moveTestToFolder(test, targetFolderId);
  }

  moveExampleToFolder(example: ExplorerExample, folderId: string | null): void {
    if (!this.schoolId || (example.folderId ?? null) === folderId) return;

    const previousFolderId = example.folderId ?? null;
    example.folderId = folderId;

    this.service.moveExampleToFolder(example.id, { folderId }).pipe(
      catchError(() => {
        example.folderId = previousFolderId;
        return of(null);
      })
    ).subscribe(() => {
      this.saveLocalFolders();
    });
  }

  moveTestToFolder(test: ExplorerTest, folderId: string | null): void {
    if (!this.schoolId || (test.folderId ?? null) === folderId) return;

    const previousFolderId = test.folderId ?? null;
    test.folderId = folderId;

    this.service.moveTestToFolder(test.id, { folderId }).pipe(
      catchError(() => {
        test.folderId = previousFolderId;
        return of(null);
      })
    ).subscribe(() => {
      this.saveLocalFolders();
    });
  }

  private pickFolderTarget(type: ExplorerTab, currentFolderId: string | null): string | null | undefined {
    const folders = [...(type === 'examples' ? this.exampleFolders : this.testFolders)]
      .sort((a, b) => this.getFolderPathLabel(a.id, type).localeCompare(this.getFolderPathLabel(b.id, type), 'de', { sensitivity: 'base' }));

    const lines = [
      '0) Root',
      ...folders.map((folder, index) => `${index + 1}) ${this.getFolderPathLabel(folder.id, type)}`)
    ];

    const currentIndex = currentFolderId === null
      ? '0'
      : String(folders.findIndex(folder => folder.id === currentFolderId) + 1);

    const input = window.prompt(
      `Zielordner wählen:\n\n${lines.join('\n')}\n\nNummer eingeben:`,
      currentIndex
    );

    if (input === null) {
      return undefined;
    }

    const parsed = Number(input);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > folders.length) {
      window.alert('Ungültige Auswahl.');
      return undefined;
    }

    return parsed === 0 ? null : folders[parsed - 1].id;
  }

  canManageExample(example: ExplorerExample): boolean {
    return this.currentUserId === this.school?.admin?.id || this.currentUserId === example.adminId;
  }

  canManageTest(test: ExplorerTest): boolean {
    return this.currentUserId === this.school?.admin?.id || this.currentUserId === test.adminId;
  }

  onItemDragStart(type: ExplorerTab, itemId: number): void {
    this.draggedItem = { type, itemId };
  }

  onItemDragEnd(): void {
    this.clearDropState();
  }

  allowDrop(event: DragEvent, target: string): void {
    if (!this.draggedItem || this.draggedItem.type !== this.activeTab) return;

    event.preventDefault();
    this.dropTarget = target;
  }

  clearDropState(): void {
    this.draggedItem = null;
    this.dropTarget = null;
  }

  onDropToRoot(event: DragEvent): void {
    event.preventDefault();
    this.moveDraggedItemTo(null);
  }

  onDropToFolder(event: DragEvent, folderId: string): void {
    event.preventDefault();
    this.moveDraggedItemTo(folderId);
  }

  private moveDraggedItemTo(folderId: string | null): void {
    if (!this.draggedItem) return;

    if (this.draggedItem.type === 'examples') {
      const example = this.examples.find(item => item.id === this.draggedItem?.itemId);
      if (example) {
        this.moveExampleToFolder(example, folderId);
      }
    } else {
      const test = this.tests.find(item => item.id === this.draggedItem?.itemId);
      if (test) {
        this.moveTestToFolder(test, folderId);
      }
    }

    this.clearDropState();
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.filter-dropdown')) {
      this.openFilterMenu = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.openFilterMenu = null;
  }

  toggleFilterMenu(menu: 'exampleTypes' | 'exampleFocuses' | 'exampleAuthors' | 'testAuthors'): void {
    this.openFilterMenu = this.openFilterMenu === menu ? null : menu;
  }

  isExampleTypeSelected(value: string): boolean {
    return this.selectedExampleTypes.includes(value);
  }

  isExampleFocusSelected(value: string): boolean {
    return this.selectedExampleFocuses.includes(value);
  }

  isExampleAuthorSelected(value: string): boolean {
    return this.selectedExampleAuthors.includes(value);
  }

  isTestAuthorSelected(value: string): boolean {
    return this.selectedTestAuthors.includes(value);
  }

  toggleExampleType(value: string): void {
    this.selectedExampleTypes = this.toggleSelection(this.selectedExampleTypes, value);
  }

  toggleExampleFocus(value: string): void {
    this.selectedExampleFocuses = this.toggleSelection(this.selectedExampleFocuses, value);
  }

  toggleExampleAuthor(value: string): void {
    this.selectedExampleAuthors = this.toggleSelection(this.selectedExampleAuthors, value);
  }

  toggleTestAuthor(value: string): void {
    this.selectedTestAuthors = this.toggleSelection(this.selectedTestAuthors, value);
  }

  getExampleTypeFilterLabel(): string {
    return this.getFilterSummary(this.selectedExampleTypes.length, 'Alle Typen');
  }

  getExampleFocusFilterLabel(): string {
    return this.getFilterSummary(this.selectedExampleFocuses.length, 'Alle Focus');
  }

  getExampleAuthorFilterLabel(): string {
    return this.getFilterSummary(this.selectedExampleAuthors.length, 'Alle Autoren');
  }

  getTestAuthorFilterLabel(): string {
    return this.getFilterSummary(this.selectedTestAuthors.length, 'Alle Autoren');
  }

  private getFilterSummary(count: number, emptyLabel: string): string {
    if (count <= 0) {
      return emptyLabel;
    }

    if (count === 1) {
      return '1 ausgewählt';
    }

    return `${count} ausgewählt`;
  }

  private toggleSelection(values: string[], value: string): string[] {
    return values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
  }

  onMultiSelectChange(event: Event, target: 'exampleTypes' | 'exampleFocuses' | 'exampleAuthors' | 'testAuthors'): void {
    const select = event.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions).map(option => option.value);

    switch (target) {
      case 'exampleTypes':
        this.selectedExampleTypes = values;
        break;
      case 'exampleFocuses':
        this.selectedExampleFocuses = values;
        break;
      case 'exampleAuthors':
        this.selectedExampleAuthors = values;
        break;
      case 'testAuthors':
        this.selectedTestAuthors = values;
        break;
    }
  }

  removeExampleType(value: string): void {
    this.selectedExampleTypes = this.selectedExampleTypes.filter(item => item !== value);
  }

  removeExampleFocus(value: string): void {
    this.selectedExampleFocuses = this.selectedExampleFocuses.filter(item => item !== value);
  }

  removeExampleAuthor(value: string): void {
    this.selectedExampleAuthors = this.selectedExampleAuthors.filter(item => item !== value);
  }

  removeTestAuthor(value: string): void {
    this.selectedTestAuthors = this.selectedTestAuthors.filter(item => item !== value);
  }

  resetExampleFilters(): void {
    this.exampleSearch = '';
    this.exampleSort = 'nameAsc';
    this.selectedExampleTypes = [];
    this.selectedExampleFocuses = [];
    this.selectedExampleAuthors = [];
    this.openFilterMenu = null;
  }

  resetTestFilters(): void {
    this.testSearch = '';
    this.testSort = 'nameAsc';
    this.selectedTestAuthors = [];
    this.openFilterMenu = null;
  }

  private readLocalFolders(): { exampleFolders: ExplorerFolder[]; testFolders: ExplorerFolder[] } {
    if (!this.schoolId) {
      return { exampleFolders: [], testFolders: [] };
    }

    const raw = localStorage.getItem(this.getFolderStorageKey());
    if (!raw) {
      return { exampleFolders: [], testFolders: [] };
    }

    try {
      const parsed = JSON.parse(raw) as { exampleFolders?: ExplorerFolder[]; testFolders?: ExplorerFolder[] };
      return {
        exampleFolders: parsed.exampleFolders ?? [],
        testFolders: parsed.testFolders ?? []
      };
    } catch {
      return { exampleFolders: [], testFolders: [] };
    }
  }

  private saveLocalFolders(): void {
    if (!this.schoolId) return;

    localStorage.setItem(this.getFolderStorageKey(), JSON.stringify({
      exampleFolders: this.exampleFolders,
      testFolders: this.testFolders
    }));
  }

  private addFolderLocal(folder: ExplorerFolder): void {
    if (folder.type === 'examples') {
      this.exampleFolders = [...this.exampleFolders, folder];
    } else {
      this.testFolders = [...this.testFolders, folder];
    }

    this.saveLocalFolders();
  }

  private replaceTemporaryFolder(original: ExplorerFolder, replacement: ExplorerFolder): void {
    if (original.type === 'examples') {
      this.exampleFolders = this.exampleFolders.map(item => item.id === original.id ? replacement : item);
    } else {
      this.testFolders = this.testFolders.map(item => item.id === original.id ? replacement : item);
    }
  }

  private replaceFolderLocal(folder: ExplorerFolder): void {
    if (folder.type === 'examples') {
      this.exampleFolders = this.exampleFolders.map(item => item.id === folder.id ? folder : item);
    } else {
      this.testFolders = this.testFolders.map(item => item.id === folder.id ? folder : item);
    }

    this.saveLocalFolders();
  }

  private removeFolderLocal(folder: ExplorerFolder): void {
    if (folder.type === 'examples') {
      this.exampleFolders = this.exampleFolders.filter(item => item.id !== folder.id);
      if (this.selectedExampleFolderId === folder.id) {
        this.selectedExampleFolderId = folder.parentId ?? null;
      }
    } else {
      this.testFolders = this.testFolders.filter(item => item.id !== folder.id);
      if (this.selectedTestFolderId === folder.id) {
        this.selectedTestFolderId = folder.parentId ?? null;
      }
    }

    this.saveLocalFolders();
  }

  private getFolderStorageKey(): string {
    return `school-explorer-folders-${this.schoolId}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  getExampleTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    const enumKey = typeof type === 'string'
      ? ExampleTypes[type as keyof typeof ExampleTypes]
      : type;

    return ExampleTypeLabels[enumKey] ?? String(type);
  }

  getFocusList(focus: Focus[]): string {
    return (focus ?? []).map(f => f.label).join(', ');
  }

  getFolderItemCount(folder: ExplorerFolder): number {
    return folder.type === 'examples'
      ? this.examples.filter(item => (item.folderId ?? null) === folder.id).length
      : this.tests.filter(item => (item.folderId ?? null) === folder.id).length;
  }

  getFolderChildrenCount(folder: ExplorerFolder): number {
    const folders = folder.type === 'examples' ? this.exampleFolders : this.testFolders;
    return folders.filter(item => item.parentId === folder.id).length;
  }

  getFolderPathLabel(folderId: string | null, type: ExplorerTab = this.activeTab): string {
    if (folderId === null) {
      return 'Root';
    }

    const folders = type === 'examples' ? this.exampleFolders : this.testFolders;
    const crumbs = this.buildBreadcrumbs(folders, folderId);

    if (!crumbs.length) {
      return 'Root';
    }

    return ['Root', ...crumbs.map(crumb => crumb.name)].join(' / ');
  }

  openCreateExample(): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(CreateExampleComponent, {
      width: isMobile ? '100vw' : 'min(96vw, 1400px)',
      maxWidth: isMobile ? '100vw' : '70vw',
      maxHeight: isMobile ? '100dvh' : '90vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : 'create-example-dialog-panel',
      data: {
        schoolId: this.schoolId,
        folderId: this.selectedExampleFolderId
      },
      autoFocus: false
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  openExample(e: ExplorerExample): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(ExamplePreviewComponent, {
      width: isMobile ? '100vw' : '40vw',
      height: isMobile ? '100dvh' : '40vh',
      maxHeight: isMobile ? '100dvh' : '70vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : undefined,
      data: { schoolId: this.schoolId, exampleId: e.id }
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  editExample(e: ExplorerExample): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(CreateExampleComponent, {
      width: isMobile ? '100vw' : 'min(96vw, 1400px)',
      maxWidth: isMobile ? '100vw' : '70vw',
      height: isMobile ? '100dvh' : '90vh',
      maxHeight: isMobile ? '100dvh' : '90vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : 'create-example-dialog-panel',
      data: { schoolId: this.schoolId, exampleId: e.id, folderId: e.folderId ?? null },
      autoFocus: false
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  createTest(): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(CreateTestComponent, {
      width: isMobile ? '100vw' : 'min(96vw, 1680px)',
      maxWidth: isMobile ? '100vw' : '96vw',
      height: isMobile ? '100dvh' : '90vh',
      maxHeight: isMobile ? '100dvh' : '90vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : 'create-test-dialog-panel',
      data: {
        schoolId: this.schoolId,
        folderId: this.selectedTestFolderId
      }
    }).afterClosed().subscribe(() => {
      this.loadTests();
    });
  }

  editTest(test: ExplorerTest): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(CreateTestComponent, {
      width: isMobile ? '100vw' : 'min(96vw, 1680px)',
      maxWidth: isMobile ? '100vw' : '96vw',
      height: isMobile ? '100dvh' : '90vh',
      maxHeight: isMobile ? '100dvh' : '90vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : 'create-test-dialog-panel',
      data: { schoolId: this.schoolId, testId: test.id, folderId: test.folderId ?? null }
    }).afterClosed().subscribe(() => {
      this.loadTests();
    });
  }

  openTest(test: ExplorerTest): void {
    this.dialog.open(TestPreviewComponent, {
      width: 'min(80vw, 950px)',
      maxWidth: '80vw',
      height: '92vh',
      maxHeight: '92vh',
      panelClass: 'test-preview-dialog',
      data: { schoolId: this.schoolId, testId: test.id }
    }).afterClosed().subscribe(() => {
      this.loadTests();
    });
  }

  deleteTest(test: ExplorerTest): void {
    const title = test.name || test.id || 'der Test';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Test löschen',
        message: `Test "${title}" wirklich löschen?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteTest(test.id).subscribe(() => {
        this.loadTests();
      });
    });
  }

  deleteExample(e: ExplorerExample): void {
    const title = e.question || e.id || 'das Beispiel';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Beispiel löschen',
        message: `Beispiel "${title}" wirklich löschen?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteExample(e.id).subscribe(() => {
        this.loadExamples();
      });
    });
  }

  openSettings(): void {
    if (!this.isAdmin || !this.schoolId) return;

    this.dialog.open(SchoolSettingsComponent, {
      width: 'min(95vw, 960px)',
      maxWidth: '95vw',
      maxHeight: '92vh',
      data: {
        schoolId: this.schoolId,
        school: this.school,
        currentUserId: this.currentUserId
      }
    }).afterClosed().subscribe(result => {
      if (result?.updated) {
        this.loadSchool();
      }
    });
  }

  getSchoolLogo(): string | null {
    return this.service.getSchoolLogo(this.school, this.schoolId!);
  }
}
