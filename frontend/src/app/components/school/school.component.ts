import { Component, HostListener, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus } from '../../model/Example';
import { TestOverviewDTO } from '../../model/Test';

import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CreateExampleComponent } from '../../dialog/create-example/create-example.component';
import { CreateTestComponent } from '../../dialog/create-test/create-test.component';
import { TestPreviewComponent } from '../../dialog/test-preview/test-preview.component';
import { ExamplePreviewComponent } from '../../dialog/example-preview/example-preview.component';
import { SchoolSettingsComponent } from '../../dialog/school-settings/school-settings.component';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import {
  FolderPickerDialogComponent,
  FolderPickerItem
} from '../../dialog/folder-picker-dialog/folder-picker-dialog.component'
import {FolderNameDialogComponent} from '../../dialog/folder-name-dialog/folder-name-dialog.component'
import {MatSnackBar} from '@angular/material/snack-bar'

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

interface DraggedExplorerItem {
  type: ExplorerTab;
  itemId: number;
}

interface DraggedExplorerFolder {
  type: ExplorerTab;
  folderId: string;
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
    MatFormFieldModule
  ],
  templateUrl: './school.component.html',
  styleUrl: './school.component.scss'
})
export class SchoolComponent implements OnInit {
  service = inject(HttpService);
  dialog = inject(MatDialog);
  translate = inject(TranslateService);
  snack = inject(MatSnackBar);

  school: SchoolDTO = {} as SchoolDTO;
  schoolId: string | null = null;

  currentUserId = -1;
  menuOpen = false;

  activeTab: ExplorerTab = 'examples';

  examples: ExampleOverviewDTO[] = [];
  tests: TestOverviewDTO[] = [];

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
  draggedFolder: DraggedExplorerFolder | null = null;
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

  private t(key: string, params?: Record<string, any>): string {
    return this.translate.instant(key, params);
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

    return [...values].sort((a, b) => a.localeCompare(b, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get availableExampleAuthors(): string[] {
    const values = new Set<string>();

    for (const example of this.examples) {
      const author = (example.adminUsername ?? '').trim();
      if (author) {
        values.add(author);
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get availableTestAuthors(): string[] {
    const values = new Set<string>();

    for (const test of this.tests) {
      const author = (test.adminUsername ?? '').trim();
      if (author) {
        values.add(author);
      }
    }

    return [...values].sort((a, b) => a.localeCompare(b, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get filteredExamples(): ExampleOverviewDTO[] {
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

  get filteredTests(): TestOverviewDTO[] {
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
      .sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get totalVisibleItemCount(): number {
    return this.activeTab === 'examples' ? this.filteredExamples.length : this.filteredTests.length;
  }

  get totalVisibleFolderCount(): number {
    return this.visibleFolders.length;
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
      this.examples = (examples as ExampleOverviewDTO[]).map(example => ({
        ...example,
        folderId: example.folderId ?? null
      }));
    });
  }

  private loadTests(): void {
    if (!this.schoolId) return;

    this.service.getTests(this.schoolId).subscribe(tests => {
      this.tests = (tests as TestOverviewDTO[]).map(test => ({
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
          return getName(b).localeCompare(getName(a), this.translate.currentLang || 'de', { sensitivity: 'base' });
        case 'createdDesc':
          return String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? ''));
        case 'createdAsc':
          return String(a.updatedAt ?? a.createdAt ?? '').localeCompare(String(b.updatedAt ?? b.createdAt ?? ''));
        case 'authorAsc':
          return getAuthor(a).localeCompare(getAuthor(b), this.translate.currentLang || 'de', { sensitivity: 'base' });
        case 'nameAsc':
        default:
          return getName(a).localeCompare(getName(b), this.translate.currentLang || 'de', { sensitivity: 'base' });
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
      .sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));
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

    const ref = this.dialog.open(FolderNameDialogComponent, {
      width: 'min(92vw, 500px)',
      maxWidth: '92vw',
      data: {
        title: this.t('school.createFolderTitle'),
        subtitle: this.t('school.createFolderSubtitle'),
        label: this.t('school.folderNameLabel'),
        placeholder: this.t('school.folderNamePlaceholder'),
        confirmText: this.t('common.create'),
        cancelText: this.t('common.cancel'),
        initialValue: ''
      }
    });

    ref.afterClosed().subscribe(name => {
      if (!name?.trim()) return;

      const now = new Date().toISOString();
      const folder: ExplorerFolder = {
        id: this.generateId(),
        schoolId: this.schoolId!,
        type: this.activeTab,
        name: name.trim(),
        parentId,
        createdAt: now,
        updatedAt: now
      };

      this.addFolderLocal(folder);

      const request = folder.type === 'examples'
        ? this.service.createExampleFolder(this.schoolId!, {
          name: folder.name,
          parentId: folder.parentId
        })
        : this.service.createTestFolder(this.schoolId!, {
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
    });
  }

  renameFolder(folder: ExplorerFolder, event?: MouseEvent): void {
    event?.stopPropagation();

    const ref = this.dialog.open(FolderNameDialogComponent, {
      width: 'min(92vw, 500px)',
      maxWidth: '92vw',
      data: {
        title: this.t('school.renameFolderTitle'),
        subtitle: this.t('school.renameFolderSubtitle'),
        label: this.t('school.folderNameLabel'),
        placeholder: this.t('school.folderNamePlaceholder'),
        confirmText: this.t('common.save'),
        cancelText: this.t('common.cancel'),
        initialValue: folder.name
      }
    });

    ref.afterClosed().subscribe(name => {
      if (!name?.trim() || name.trim() === folder.name) return;

      const updated: ExplorerFolder = {
        ...folder,
        name: name.trim(),
        updatedAt: new Date().toISOString()
      };

      this.replaceFolderLocal(updated);

      const request = folder.type === 'examples'
        ? this.service.renameExampleFolder(folder.id, { name: updated.name, parentId: updated.parentId })
        : this.service.renameTestFolder(folder.id, { name: updated.name, parentId: updated.parentId });

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
    });
  }

  deleteFolder(folder: ExplorerFolder, event?: MouseEvent): void {
    event?.stopPropagation();

    const hasChildFolders = this.currentFolders.some(item => item.parentId === folder.id);
    const hasItems = folder.type === 'examples'
      ? this.examples.some(item => (item.folderId ?? null) === folder.id)
      : this.tests.some(item => (item.folderId ?? null) === folder.id);

    if (hasChildFolders || hasItems) {
      this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.t('school.folderNotEmptyTitle'),
          message: this.t('school.folderNotEmpty'),
          confirmText: this.t('common.ok'),
          cancelText: this.t('common.close')
        }
      });
      return;
    }

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.t('school.deleteFolderTitle'),
        message: this.t('school.folderDeleteConfirm', { name: folder.name }),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.t('school.confirmDeleteFolder')
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

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
    });
  }

  moveExampleWithPicker(example: ExampleOverviewDTO): void {
    this.openFolderPicker('examples', example.folderId ?? null)
      .subscribe(targetFolderId => {
        if (targetFolderId === undefined) return;
        this.moveExampleToFolder(example, targetFolderId);
      });
  }

  moveTestWithPicker(test: TestOverviewDTO): void {
    this.openFolderPicker('tests', test.folderId ?? null)
      .subscribe(targetFolderId => {
        if (targetFolderId === undefined) return;
        this.moveTestToFolder(test, targetFolderId);
      });
  }


  moveFolderWithPicker(folder: ExplorerFolder, event?: MouseEvent): void {
    event?.stopPropagation();

    this.openFolderPicker(folder.type, folder.parentId ?? null, folder.id)
      .subscribe(targetFolderId => {
        if (targetFolderId === undefined) return;
        this.moveFolderToParent(folder, targetFolderId);
      });
  }

  moveExampleToFolder(example: ExampleOverviewDTO, folderId: string | null): void {
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

  moveTestToFolder(test: TestOverviewDTO, folderId: string | null): void {
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

  private pickFolderTarget(type: ExplorerTab, currentFolderId: string | null, excludeFolderId?: string): string | null | undefined {
    const folders = [...(type === 'examples' ? this.exampleFolders : this.testFolders)]
      .filter(folder => !excludeFolderId || (folder.id !== excludeFolderId && !this.isDescendantFolder(folder.id, excludeFolderId, type)))
      .sort((a, b) =>
        this.getFolderPathLabel(a.id, type).localeCompare(
          this.getFolderPathLabel(b.id, type),
          this.translate.currentLang || 'de',
          { sensitivity: 'base' }
        )
      );

    const lines = [
      `0) ${this.t('school.root')}`,
      ...folders.map((folder, index) => `${index + 1}) ${this.getFolderPathLabel(folder.id, type)}`)
    ];

    const currentIndex = currentFolderId === null
      ? '0'
      : String(folders.findIndex(folder => folder.id === currentFolderId) + 1);

    const input = window.prompt(
      `${this.t('school.prompts.chooseTargetFolder')}\n\n${lines.join('\n')}\n\n${this.t('school.prompts.enterNumber')}`,
      currentIndex
    );

    if (input === null) {
      return undefined;
    }

    const parsed = Number(input);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > folders.length) {
      this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.t('common.error'),
          message: this.t('school.invalidSelection'),
          confirmText: this.t('common.ok'),
          cancelText: this.t('common.close')
        }
      });
      return undefined;
    }

    return parsed === 0 ? null : folders[parsed - 1].id;
  }

  canManageExample(example: ExampleOverviewDTO): boolean {
    return this.currentUserId === this.school?.admin?.id || this.currentUserId === example.adminId;
  }

  canManageTest(test: TestOverviewDTO): boolean {
    return this.currentUserId === this.school?.admin?.id || this.currentUserId === test.adminId;
  }

  onItemDragStart(type: ExplorerTab, itemId: number): void {
    this.draggedFolder = null;
    this.draggedItem = { type, itemId };
  }

  onItemDragEnd(): void {
    this.clearDropState();
  }

  onFolderDragStart(folder: ExplorerFolder, event?: DragEvent): void {
    event?.stopPropagation();
    event?.dataTransfer?.setData('text/plain', folder.id);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.draggedItem = null;
    this.draggedFolder = {
      type: folder.type,
      folderId: folder.id
    };
  }

  onFolderDragEnd(): void {
    this.clearDropState();
  }

  allowDrop(event: DragEvent, target: string): void {
    if (this.draggedItem && this.draggedItem.type === this.activeTab) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.dropTarget = target;
      return;
    }

    if (this.draggedFolder && this.draggedFolder.type === this.activeTab) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.dropTarget = target;
    }
  }

  onDropLeave(event: DragEvent, target: string): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    if (this.dropTarget === target) {
      this.dropTarget = null;
    }
  }

  clearDropState(): void {
    this.draggedItem = null;
    this.draggedFolder = null;
    this.dropTarget = null;
  }

  onDropToRoot(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.draggedFolder) {
      this.moveDraggedFolderTo(null);
      return;
    }

    this.moveDraggedItemTo(null);
  }

  onDropToFolder(event: DragEvent, folderId: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.draggedFolder) {
      this.moveDraggedFolderTo(folderId);
      return;
    }

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

  private moveDraggedFolderTo(parentId: string | null): void {
    if (!this.draggedFolder) return;

    const folder = this.currentFolders.find(item => item.id === this.draggedFolder?.folderId);
    if (!folder) {
      this.clearDropState();
      return;
    }

    this.moveFolderToParent(folder, parentId);
    this.clearDropState();
  }

  private moveFolderToParent(folder: ExplorerFolder, parentId: string | null): void {
    if ((folder.parentId ?? null) === parentId) {
      return;
    }

    if (parentId === folder.id) {
      return;
    }

    if (parentId && this.isDescendantFolder(parentId, folder.id, folder.type)) {
      this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.t('common.error'),
          message: this.t('school.folderMoveInvalid'),
          confirmText: this.t('common.ok'),
          cancelText: this.t('common.close')
        }
      });
      return;
    }

    const previousFolders = folder.type === 'examples'
      ? [...this.exampleFolders]
      : [...this.testFolders];

    const updated: ExplorerFolder = {
      ...folder,
      parentId,
      updatedAt: new Date().toISOString()
    };

    this.replaceFolderLocal(updated);

    const request = folder.type === 'examples'
      ? this.service.moveExampleFolder(folder.id, { name: updated.name, parentId })
      : this.service.moveTestFolder(folder.id, { name: updated.name, parentId });

    request.pipe(
      catchError(() => {
        if (folder.type === 'examples') {
          this.exampleFolders = previousFolders;
        } else {
          this.testFolders = previousFolders;
        }
        this.saveLocalFolders();
        return of(null);
      })
    ).subscribe((folderFromApi: any) => {
      if (folderFromApi) {
        this.replaceFolderLocal({
          ...updated,
          ...(folderFromApi as Partial<ExplorerFolder>),
          type: folder.type
        });
      }
      this.saveLocalFolders();
    });
  }

  private isDescendantFolder(candidateParentId: string, draggedFolderId: string, type: ExplorerTab): boolean {
    const folders = type === 'examples' ? this.exampleFolders : this.testFolders;
    let current = folders.find(folder => folder.id === candidateParentId) ?? null;

    while (current) {
      if (current.id === draggedFolderId) {
        return true;
      }
      current = folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return false;
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
    return this.getFilterSummary(this.selectedExampleTypes.length, this.t('school.allTypes'));
  }

  getExampleFocusFilterLabel(): string {
    return this.getFilterSummary(this.selectedExampleFocuses.length, this.t('school.allFocuses'));
  }

  getExampleAuthorFilterLabel(): string {
    return this.getFilterSummary(this.selectedExampleAuthors.length, this.t('school.allAuthors'));
  }

  getTestAuthorFilterLabel(): string {
    return this.getFilterSummary(this.selectedTestAuthors.length, this.t('school.allAuthors'));
  }

  private getFilterSummary(count: number, emptyLabel: string): string {
    if (count <= 0) {
      return emptyLabel;
    }

    if (count === 1) {
      return this.t('school.selectedOne');
    }

    return this.t('school.selectedMany', { count });
  }

  private toggleSelection(values: string[], value: string): string[] {
    return values.includes(value)
      ? values.filter(item => item !== value)
      : [...values, value];
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
      return this.t('school.root');
    }

    const folders = type === 'examples' ? this.exampleFolders : this.testFolders;
    const crumbs = this.buildBreadcrumbs(folders, folderId);

    if (!crumbs.length) {
      return this.t('school.root');
    }

    return [this.t('school.root'), ...crumbs.map(crumb => crumb.name)].join(' / ');
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

  openExample(e: ExampleOverviewDTO): void {
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

  editExample(e: ExampleOverviewDTO): void {
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

  editTest(test: TestOverviewDTO): void {
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

  openTest(test: TestOverviewDTO): void {
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

  deleteTest(test: TestOverviewDTO): void {
    const title = test.name || String(test.id) || this.t('school.test');

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.t('school.deleteTestTitle'),
        message: this.t('school.deleteTestMessage', { name: title }),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel')
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.service.deleteTest(test.id).subscribe({
        next: () => {
          this.loadTests();
        },
        error: (err) => {
          this.showErrorSnack(err);
        }
      });
    });
  }

  deleteExample(e: ExampleOverviewDTO): void {
    const title = e.question || String(e.id) || this.t('school.example');

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.t('school.deleteExampleTitle'),
        message: this.t('school.deleteExampleMessage', { name: title }),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel')
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.service.deleteExample(e.id).subscribe({
        next: () => {
          this.loadExamples();
        },
        error: (err) => {
          this.showErrorSnack(err);
        }
      });
    });
  }

  private showErrorSnack(err: any): void {
    const message =
      (typeof err?.error === 'string' && err.error.trim()) ||
      err?.error?.message ||
      err?.message ||
      this.t('common.error');

    this.snack.open(message, this.t('common.close'), {
      duration: 5000,
      verticalPosition: 'bottom',
      panelClass: ['snackbar-error']
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

  private openFolderPicker(
    type: ExplorerTab,
    currentFolderId: string | null,
    excludeFolderId?: string
  ) {
    const folders = [...(type === 'examples' ? this.exampleFolders : this.testFolders)]
      .filter(folder =>
        !excludeFolderId ||
        (folder.id !== excludeFolderId && !this.isDescendantFolder(folder.id, excludeFolderId, type))
      )
      .sort((a, b) =>
        this.getFolderPathLabel(a.id, type).localeCompare(
          this.getFolderPathLabel(b.id, type),
          this.translate.currentLang || 'de',
          { sensitivity: 'base' }
        )
      );

    const dialogFolders: FolderPickerItem[] = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      path: this.getFolderPathLabel(folder.id, type)
    }));

    return this.dialog.open(FolderPickerDialogComponent, {
      width: 'min(92vw, 640px)',
      maxWidth: '92vw',
      data: {
        title: this.t('school.folderPickerTitle'),
        subtitle: this.t('school.folderPickerSubtitle'),
        rootLabel: this.t('school.root'),
        currentFolderId,
        folders: dialogFolders
      }
    }).afterClosed();
  }
}
