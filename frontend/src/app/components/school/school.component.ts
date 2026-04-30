import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {catchError, finalize, firstValueFrom, forkJoin, of, Subject, Subscription, takeUntil} from 'rxjs';

import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus } from '../../model/Example';
import { TestOverviewDTO } from '../../model/Test';
import { FolderDTO } from '../../model/Folder';

import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CreateExampleComponent } from '../../dialog/create-example/create-example.component';
import { CreateTestComponent } from '../../dialog/create-test/create-test.component';
import { TestPreviewComponent } from '../../dialog/test-preview/test-preview.component';
import { ExamplePreviewComponent } from '../../dialog/example-preview/example-preview.component';
import { SchoolSettingsComponent } from '../../dialog/school-settings/school-settings.component';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import {
  FolderPickerDialogComponent,
  FolderPickerItem
} from '../../dialog/folder-picker-dialog/folder-picker-dialog.component';
import { FolderNameDialogComponent } from '../../dialog/folder-name-dialog/folder-name-dialog.component';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import {NgIf} from '@angular/common'

type ExplorerItemType = 'examples' | 'tests';
type SortOption = 'nameAsc' | 'nameDesc' | 'createdDesc' | 'createdAsc' | 'authorAsc';
type ViewMode = 'grid' | 'compact';

interface ExplorerFolder extends FolderDTO {}

interface ExplorerItem {
  id: number | string;
  type: ExplorerItemType;
  title: string;
  subtitle: string;
  author: string;
  folderId: string | null;
  createdAt?: string;
  updatedAt?: string;
  raw: ExampleOverviewDTO | TestOverviewDTO;
}

interface DraggedExplorerItem {
  type: ExplorerItemType;
  itemId: number | string;
}

interface DraggedExplorerFolder {
  folderId: string;
}

interface FilterChip {
  key: string;
  label: string;
  action: () => void;
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
    MatFormFieldModule,
    MatProgressBarModule,
    NgIf
  ],
  templateUrl: './school.component.html',
  styleUrl: './school.component.scss'
})
export class SchoolComponent implements OnInit, OnDestroy {
  service = inject(HttpService);
  dialog = inject(MatDialog);
  translate = inject(TranslateService);
  snack = inject(MatSnackBar);
  navbarActions = inject(NavbarActionsService);
  private readonly destroy$ = new Subject<void>();

  school: SchoolDTO = {} as SchoolDTO;
  schoolId: string | null = null;
  currentUserId: string = '';

  examples: ExampleOverviewDTO[] = [];
  tests: TestOverviewDTO[] = [];
  folders: ExplorerFolder[] = [];

  logoUrl: string | null = null;

  selectedFolderId: string | null = null;
  search = '';
  sort: SortOption = 'nameAsc';
  currentViewMode: ViewMode = 'grid';

  selectedItemTypes: ExplorerItemType[] = ['examples', 'tests'];
  selectedExampleTypes: string[] = [];
  selectedExampleFocuses: string[] = [];
  selectedAuthors: string[] = [];

  isFilterPopupOpen = false;

  draggedItem: DraggedExplorerItem | null = null;
  draggedFolder: DraggedExplorerFolder | null = null;
  dropTarget: string | null = null;

  deletingFolderIds = new Set<string>();
  deletingExampleIds = new Set<string>();
  deletingTestIds = new Set<number | string>();

  isSchoolLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.schoolId = params.get('id');

      if (!this.schoolId) {
        this.redirectToNotFound();
        return;
      }

      localStorage.setItem('lastViewedSchoolId', this.schoolId);
      this.reloadAll();
    });
  }

  ngOnInit(): void {
    this.service.getUserId().pipe(takeUntil(this.destroy$)).subscribe(id => {
      this.currentUserId = id;
    });

    this.service.getCollectionLogo(this.schoolId).subscribe({
      next: (blob) => {
        this.logoUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.logoUrl = null;
      }
    });

    this.connectCollectionSocket()
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.navbarActions.clearAll();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isFilterPopupOpen = false;
  }

  private reloadAll(): void {
    if (!this.schoolId) {
      this.redirectToNotFound();
      return;
    }

    this.isSchoolLoading = true;
    this.navbarActions.clearAll();
    this.school = {} as SchoolDTO;
    this.examples = [];
    this.tests = [];
    this.folders = [];

    this.service.getCollectionLogo(this.schoolId).subscribe({
      next: (blob) => {
        this.logoUrl = URL.createObjectURL(blob);
      },
      error: () => {
        this.logoUrl = null;
      }
    });

    forkJoin({
      school: this.service.getCollectionById(this.schoolId).pipe(catchError(() => of(null))),
      folders: this.service.getFolders(this.schoolId).pipe(catchError(() => of([] as FolderDTO[]))),
      examples: this.service.getExamples(this.schoolId).pipe(catchError(() => of([] as ExampleOverviewDTO[]))),
      tests: this.service.getTests(this.schoolId).pipe(catchError(() => of([] as TestOverviewDTO[])))
    })
      .pipe(
        finalize(() => this.isSchoolLoading = false),
        takeUntil(this.destroy$)
      )
      .subscribe(({ school, folders, examples, tests }) => {
        if (!school) {
          this.redirectToNotFound();
          return;
        }

        this.school = school;
        this.folders = this.normalizeFolders(folders as FolderDTO[]);
        this.examples = (examples as ExampleOverviewDTO[]).map(example => ({ ...example, folderId: example.folderId ?? null }));
        this.tests = (tests as TestOverviewDTO[]).map(test => ({ ...test, folderId: test.folderId ?? null }));
        this.ensureSelectedFolderStillExists();
        this.setNavbarActions();
      });
  }

  private setNavbarActions(): void {
    const breadcrumbs: Array<{ labelKey?: string; route?: any[]; label?: string }> = [
      { labelKey: 'navbar.home', route: ['/home'] },
      { label: this.school.name || this.t('school.untitled'), route: [`/collection/${this.schoolId}`] }
    ];

    this.navbarActions.setBreadcrumbs(breadcrumbs as any);
    this.navbarActions.setActions([
      {
        labelKey: 'school.example',
        icon: 'post_add',
        variant: 'flat',
        action: () => this.openCreateExample()
      },
      {
        labelKey: 'school.test',
        icon: 'assignment',
        variant: 'stroked',
        action: () => this.createTest()
      },
      {
        icon: 'create_new_folder',
        variant: 'icon',
        action: () => this.createFolder()
      },
      {
        icon: 'settings',
        variant: 'icon',
        action: () => this.openSettings()
      }
    ]);
  }

  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private socketDestroyed = false;
  private connectCollectionSocket(): void {
    const socketUrl = this.service.getCollectionSocketUrl(this.schoolId);

    if (!socketUrl || typeof WebSocket === 'undefined') {
      return;
    }

    if (this.socket && (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    try {
      this.socket = new WebSocket(socketUrl);

      this.socket.onopen = () => {
        console.log('Collection socket verbunden');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = undefined;
        }
      };

      this.socket.onmessage = (event: MessageEvent<string>) => {
        if (event.data == 'update' && !this.isAuthPage()) {
          this.reloadAll();
        }
      };

      this.socket.onerror = (error) => {
        console.error('Collection socket Fehler:', error);
      };

      this.socket.onclose = (event) => {
        console.warn('Collection socket geschlossen:', event.code, event.reason);
        this.socket = undefined;

        if (this.socketDestroyed) {
          return;
        }

        this.reconnectTimer = setTimeout(() => {
          this.connectCollectionSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Collection socket konnte nicht aufgebaut werden:', error);
    }
  }

  isAuthPage(): boolean {
    return this.router.url.startsWith('/login');
  }

  private t(key: string, params?: Record<string, any>): string {
    return this.translate.instant(key, params);
  }

  get isAdmin(): boolean {
    return this.currentUserId === this.school?.admin?.id;
  }

  get currentFolder(): ExplorerFolder | null {
    return this.folders.find(folder => folder.id === this.selectedFolderId) ?? null;
  }

  get currentBreadcrumbs(): ExplorerFolder[] {
    return this.buildBreadcrumbs(this.selectedFolderId);
  }

  get isSearching(): boolean {
    return this.search.trim().length > 0;
  }

  get headerTitle(): string {
    if (this.isSearching) {
      return this.t('school.searchResults');
    }

    return this.currentFolder?.name || this.school.name || this.t('school.root');
  }

  get headerSubtitle(): string {
    if (this.isSearching) {
      return this.t('school.searchResultsInAllFolders');
    }

    const path = this.currentFolder ? this.getFolderPathLabel(this.currentFolder.id) : '';
    return path || '';
  }

  get availableExampleTypes(): { value: string; label: string }[] {
    const values = Object.values(ExampleTypes).filter(v => typeof v !== 'number') as string[];
    return values.map(value => ({ value, label: this.getExampleTypeLabel(value) }));
  }

  get availableExampleFocuses(): string[] {
    const values = new Set<string>();
    for (const example of this.examples) {
      for (const focus of example.focusList ?? []) {
        const label = (focus.label ?? '').trim();
        if (label) values.add(label);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get availableAuthors(): string[] {
    const values = new Set<string>();
    for (const example of this.examples) {
      const author = (example.adminUsername ?? '').trim();
      if (author) values.add(author);
    }
    for (const test of this.tests) {
      const author = (test.adminUsername ?? '').trim();
      if (author) values.add(author);
    }
    return [...values].sort((a, b) => a.localeCompare(b, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get activeFilterCount(): number {
    return this.selectedItemTypes.length < 2
      ? 1 + this.selectedExampleTypes.length + this.selectedExampleFocuses.length + this.selectedAuthors.length
      : this.selectedExampleTypes.length + this.selectedExampleFocuses.length + this.selectedAuthors.length;
  }

  get activeFilterChips(): FilterChip[] {
    const chips: FilterChip[] = [];

    if (this.selectedItemTypes.length < 2) {
      for (const type of this.selectedItemTypes) {
        chips.push({
          key: `type-${type}`,
          label: this.t(type === 'examples' ? 'school.examples' : 'school.tests'),
          action: () => this.toggleItemType(type)
        });
      }
    }

    for (const type of this.selectedExampleTypes) {
      chips.push({
        key: `example-type-${type}`,
        label: this.getExampleTypeLabel(type),
        action: () => this.removeExampleType(type)
      });
    }

    for (const focus of this.selectedExampleFocuses) {
      chips.push({
        key: `focus-${focus}`,
        label: focus,
        action: () => this.removeExampleFocus(focus)
      });
    }

    for (const author of this.selectedAuthors) {
      chips.push({
        key: `author-${author}`,
        label: author,
        action: () => this.removeAuthor(author)
      });
    }

    return chips;
  }

  get visibleFolders(): ExplorerFolder[] {
    const search = this.search.trim().toLowerCase();

    if (!search) {
      return this.folders
        .filter(folder => folder.parentId === this.selectedFolderId)
        .sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));
    }

    return this.folders
      .filter(folder =>
        folder.name.toLowerCase().includes(search) ||
        this.getFolderPathLabel(folder.id).toLowerCase().includes(search)
      )
      .sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));
  }

  get visibleItems(): ExplorerItem[] {
    let items: ExplorerItem[] = [
      ...this.examples.map(example => this.toExplorerExample(example)),
      ...this.tests.map(test => this.toExplorerTest(test))
    ];

    if (!this.isSearching) {
      items = items.filter(item => (item.folderId ?? null) === this.selectedFolderId);
    }

    if (this.selectedItemTypes.length) {
      items = items.filter(item => this.selectedItemTypes.includes(item.type));
    }

    const search = this.search.trim().toLowerCase();
    if (search) {
      items = items.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.subtitle.toLowerCase().includes(search) ||
        item.author.toLowerCase().includes(search) ||
        this.getFolderPathLabel(item.folderId).toLowerCase().includes(search) ||
        (item.type === 'examples' && this.getExampleSearchHaystack(item.raw as ExampleOverviewDTO).includes(search)) ||
        (item.type === 'tests' && this.getTestSearchHaystack(item.raw as TestOverviewDTO).includes(search))
      );
    }

    if (this.selectedExampleTypes.length) {
      items = items.filter(item => item.type !== 'examples' || this.selectedExampleTypes.includes(String((item.raw as ExampleOverviewDTO).type)));
    }

    if (this.selectedExampleFocuses.length) {
      const selected = this.selectedExampleFocuses.map(v => v.toLowerCase());
      items = items.filter(item => item.type !== 'examples' || ((item.raw as ExampleOverviewDTO).focusList ?? []).some(f => selected.includes((f.label ?? '').toLowerCase())));
    }

    if (this.selectedAuthors.length) {
      items = items.filter(item => this.selectedAuthors.includes(item.author));
    }

    return this.sortExplorerItems(items);
  }

  get totalVisibleFolderCount(): number {
    return this.visibleFolders.length;
  }

  get totalVisibleItemCount(): number {
    return this.visibleItems.length;
  }

  private loadSchool(): void {
    if (!this.schoolId) return;
    this.service.getCollectionById(this.schoolId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.redirectToNotFound();
          return of(null);
        })
      )
      .subscribe(school => {
        if (!school) return;
        this.school = school;
        this.setNavbarActions();
      });
  }

  private loadExamples(): void {
    if (!this.schoolId) return;
    this.service.getExamples(this.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(examples => {
        this.examples = (examples).map(example => ({ ...example, folderId: example.folderId ?? null }));
      });
  }

  private loadTests(): void {
    if (!this.schoolId) return;
    this.service.getTests(this.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(tests => {
        this.tests = (tests as TestOverviewDTO[]).map(test => ({ ...test, folderId: test.folderId ?? null }));
      });
  }

  private loadFolders(): void {
    if (!this.schoolId) return;
    this.service.getFolders(this.schoolId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([]))
      )
      .subscribe(folders => {
        this.folders = this.normalizeFolders(folders as FolderDTO[]);
        this.ensureSelectedFolderStillExists();
        this.setNavbarActions();
      });
  }

  private redirectToNotFound(): void {
    this.navbarActions.clearAll();
    this.router.navigate(['/404']);
  }

  private normalizeFolders(folders: FolderDTO[]): ExplorerFolder[] {
    return (folders ?? []).map(folder => ({
      id: folder.id,
      schoolId: folder.schoolId,
      name: folder.name,
      parentId: folder.parentId ?? null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    }));
  }

  private ensureSelectedFolderStillExists(): void {
    if (!this.selectedFolderId) return;
    if (!this.folders.some(folder => folder.id === this.selectedFolderId)) {
      this.selectedFolderId = null;
    }
  }

  toggleFilterPopup(event: MouseEvent): void {
    event.stopPropagation();
    this.isFilterPopupOpen = !this.isFilterPopupOpen;
  }

  stopClick(event: Event): void {
    event.stopPropagation();
  }

  setCurrentViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
  }

  selectFolder(folderId: string | null): void {
    this.selectedFolderId = folderId;
    this.setNavbarActions();
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

  private buildBreadcrumbs(folderId: string | null): ExplorerFolder[] {
    if (!folderId) return [];
    const result: ExplorerFolder[] = [];
    let current = this.folders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      result.unshift(current);
      current = this.folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return result;
  }

  isDeletingFolder(folderId: string): boolean {
    return this.deletingFolderIds.has(folderId);
  }

  isDeletingItem(item: ExplorerItem): boolean {
    return item.type === 'examples'
      ? this.deletingExampleIds.has(String(item.id))
      : this.deletingTestIds.has(item.id);
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
      if (!name?.trim() || !this.schoolId) return;
      this.service.createFolder(this.schoolId, {
        name: name.trim(),
        parentId
      }).subscribe({
        next: folder => {
          this.folders = [...this.folders, folder as ExplorerFolder];
          this.setNavbarActions();
          this.snack.open(this.t('school.newFolder'), this.t('common.close'), { duration: 2500 });
        },
        error: err => this.showErrorSnack(err)
      });
    });
  }

  renameFolder(folder: ExplorerFolder, event?: Event): void {
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
      if (!name?.trim()) return;

      this.service.updateFolder(folder.id, {
        name: name.trim(),
        parentId: folder.parentId ?? null
      }).subscribe({
        next: updatedFolder => {
          this.folders = this.folders.map(item => item.id === folder.id ? updatedFolder as ExplorerFolder : item);
          this.setNavbarActions();
        },
        error: err => this.showErrorSnack(err)
      });
    });
  }

  async deleteFolder(folder: ExplorerFolder, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.isDeletingFolder(folder.id)) return;

    const impact = await this.buildFolderDeleteImpact(folder);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '650px',
      maxWidth: '92vw',
      data: {
        title: `Ordner „${folder.name}“ löschen?`,
        message: this.buildFolderDeleteMessage(folder, impact),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: 'Ich bestätige, dass der Ordner inklusive Inhalt gelöscht werden soll.'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deleteFolderWithContent(folder, impact);
    });
  }

  moveFolderWithPicker(folder: ExplorerFolder, event?: Event): void {
    event?.stopPropagation();

    this.openFolderPicker(folder.parentId ?? null, folder.id).subscribe((targetFolderId: string | null | undefined) => {
      if (targetFolderId === undefined || targetFolderId === folder.id) return;
      if (this.isDescendantFolder(targetFolderId, folder.id)) return;

      this.service.updateFolder(folder.id, {
        name: folder.name,
        parentId: targetFolderId ?? null
      }).subscribe({
        next: updatedFolder => {
          this.folders = this.folders.map(item => item.id === folder.id ? updatedFolder as ExplorerFolder : item);
          this.setNavbarActions();
        },
        error: err => this.showErrorSnack(err)
      });
    });
  }

  moveExampleToFolder(example: ExampleOverviewDTO, folderId: string | null): void {
    this.service.moveExampleToFolder(example.id, folderId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.examples = this.examples.map(item =>
          item.id === example.id ? { ...item, folderId } : item
        );
      });
  }

  moveTestToFolder(test: TestOverviewDTO, folderId: string | null): void {
    this.service.moveTestToFolder(test.id, folderId)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.tests = this.tests.map(item =>
          item.id === test.id ? { ...item, folderId } : item
        );
      });
  }

  onItemDragStart(type: ExplorerItemType, itemId: number | string): void {
    this.draggedItem = { type, itemId };
  }

  onItemDragEnd(): void {
    this.draggedItem = null;
    this.clearDropState();
  }

  onFolderDragStart(folder: ExplorerFolder, event?: DragEvent): void {
    event?.stopPropagation();
    this.draggedFolder = { folderId: folder.id };
  }

  onFolderDragEnd(): void {
    this.draggedFolder = null;
    this.clearDropState();
  }

  allowDrop(event: DragEvent, target: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropTarget = target;
  }

  onDropLeave(event: DragEvent, target: string): void {
    event.stopPropagation();
    if (this.dropTarget === target) {
      this.dropTarget = null;
    }
  }

  onDropToFolder(event: DragEvent, folderId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.handleDrop(folderId);
  }

  private handleDrop(folderId: string | null): void {
    if (this.draggedItem) {
      if (this.draggedItem.type === 'examples') {
        const example = this.examples.find(item => item.id === this.draggedItem?.itemId.toString());
        if (example) this.moveExampleToFolder(example, folderId);
      } else {
        const test = this.tests.find(item => item.id === this.draggedItem?.itemId);
        if (test) this.moveTestToFolder(test, folderId);
      }
    }

    if (this.draggedFolder) {
      const folder = this.folders.find(item => item.id === this.draggedFolder?.folderId);
      if (folder && folder.id !== folderId && !this.isDescendantFolder(folderId, folder.id)) {
        this.service.updateFolder(folder.id, {
          name: folder.name,
          parentId: folderId
        }).pipe(catchError(() => of(null))).subscribe(updatedFolder => {
          if (!updatedFolder) return;
          this.folders = this.folders.map(item => item.id === folder.id ? updatedFolder as ExplorerFolder : item);
          this.setNavbarActions();
        });
      }
    }

    this.draggedItem = null;
    this.draggedFolder = null;
    this.clearDropState();
  }

  private clearDropState(): void {
    this.dropTarget = null;
  }

  private isDescendantFolder(folderId: string | null, parentFolderId: string): boolean {
    if (!folderId) return false;

    let current = this.folders.find(item => item.id === folderId) ?? null;
    while (current) {
      if (current.parentId === parentFolderId) return true;
      current = this.folders.find(item => item.id === current?.parentId) ?? null;
    }
    return false;
  }

  toggleItemType(type: ExplorerItemType): void {
    if (this.selectedItemTypes.includes(type)) {
      if (this.selectedItemTypes.length === 1) return;
      this.selectedItemTypes = this.selectedItemTypes.filter(item => item !== type);
      return;
    }

    this.selectedItemTypes = [...this.selectedItemTypes, type];
  }

  isItemTypeSelected(type: ExplorerItemType): boolean {
    return this.selectedItemTypes.includes(type);
  }

  toggleExampleType(type: string): void {
    this.selectedExampleTypes = this.selectedExampleTypes.includes(type)
      ? this.selectedExampleTypes.filter(item => item !== type)
      : [...this.selectedExampleTypes, type];
  }

  isExampleTypeSelected(type: string): boolean {
    return this.selectedExampleTypes.includes(type);
  }

  removeExampleType(type: string): void {
    this.selectedExampleTypes = this.selectedExampleTypes.filter(item => item !== type);
  }

  toggleExampleFocus(focus: string): void {
    this.selectedExampleFocuses = this.selectedExampleFocuses.includes(focus)
      ? this.selectedExampleFocuses.filter(item => item !== focus)
      : [...this.selectedExampleFocuses, focus];
  }

  isExampleFocusSelected(focus: string): boolean {
    return this.selectedExampleFocuses.includes(focus);
  }

  removeExampleFocus(focus: string): void {
    this.selectedExampleFocuses = this.selectedExampleFocuses.filter(item => item !== focus);
  }

  toggleAuthor(author: string): void {
    this.selectedAuthors = this.selectedAuthors.includes(author)
      ? this.selectedAuthors.filter(item => item !== author)
      : [...this.selectedAuthors, author];
  }

  isAuthorSelected(author: string): boolean {
    return this.selectedAuthors.includes(author);
  }

  removeAuthor(author: string): void {
    this.selectedAuthors = this.selectedAuthors.filter(item => item !== author);
  }

  resetFilters(): void {
    this.selectedItemTypes = ['examples', 'tests'];
    this.selectedExampleTypes = [];
    this.selectedExampleFocuses = [];
    this.selectedAuthors = [];
  }

  private getExampleSearchHaystack(example: ExampleOverviewDTO): string {
    return [
      example.instruction,
      example.question,
      example.adminUsername,
      ...(example.focusList ?? []).map(focus => focus.label)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  private getTestSearchHaystack(test: TestOverviewDTO): string {
    return [test.name, test.adminUsername].filter(Boolean).join(' ').toLowerCase();
  }

  private toExplorerExample(example: ExampleOverviewDTO): ExplorerItem {
    return {
      id: example.id,
      type: 'examples',
      title: example.instruction || this.t('school.untitled'),
      subtitle: this.getFolderPathLabel(example.folderId ?? null),
      author: example.adminUsername || '—',
      folderId: example.folderId ?? null,
      createdAt: example.createdAt,
      updatedAt: example.updatedAt,
      raw: example
    };
  }

  private toExplorerTest(test: TestOverviewDTO): ExplorerItem {
    return {
      id: test.id,
      type: 'tests',
      title: test.name || this.t('school.untitled'),
      subtitle: `${test.amountOfQuestions} ${this.t('school.questions')} · ${this.getFolderPathLabel(test.folderId ?? null)}`,
      author: test.adminUsername || '—',
      folderId: test.folderId ?? null,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      raw: test
    };
  }

  private sortExplorerItems(items: ExplorerItem[]): ExplorerItem[] {
    const getDate = (value?: string) => value ? new Date(value).getTime() : 0;

    return [...items].sort((a, b) => {
      switch (this.sort) {
        case 'nameDesc':
          return b.title.localeCompare(a.title, this.translate.currentLang || 'de', { sensitivity: 'base' });
        case 'createdDesc':
          return getDate(b.updatedAt || b.createdAt) - getDate(a.updatedAt || a.createdAt);
        case 'createdAsc':
          return getDate(a.updatedAt || a.createdAt) - getDate(b.updatedAt || b.createdAt);
        case 'authorAsc':
          return a.author.localeCompare(b.author, this.translate.currentLang || 'de', { sensitivity: 'base' });
        case 'nameAsc':
        default:
          return a.title.localeCompare(b.title, this.translate.currentLang || 'de', { sensitivity: 'base' });
      }
    });
  }

  getExampleTypeLabel(type: string): string {
    const translationKey = ExampleTypeLabels[type as ExampleTypes];

    if (translationKey) {
      if (translationKey.startsWith('exampleTypes.') || translationKey.startsWith('exampleTypeDescriptions.')) {
        return this.t(translationKey);
      }

      const normalized = {
        [ExampleTypes.OPEN]: 'exampleTypes.open',
        [ExampleTypes.HALF_OPEN]: 'exampleTypes.halfOpen',
        [ExampleTypes.CONSTRUCTION]: 'exampleTypes.construction',
        [ExampleTypes.MULTIPLE_CHOICE]: 'exampleTypes.multipleChoice',
        [ExampleTypes.GAP_FILL]: 'exampleTypes.gapFill',
        [ExampleTypes.ASSIGN]: 'exampleTypes.assign'
      } as Record<string, string>;

      return this.t(normalized[type] ?? translationKey);
    }

    return type;
  }

  getItemMeta(item: ExplorerItem): string {
    return [this.getItemTypeLabel(item), item.author, item.subtitle]
      .map(part => (part ?? '').trim())
      .filter(Boolean)
      .join(' · ');
  }

  getItemTypeLabel(item: ExplorerItem): string {
    if (item.type === 'examples') {
      return this.getExampleTypeLabel(String((item.raw as ExampleOverviewDTO).type));
    }
    return this.t('school.test');
  }

  getItemIcon(item: ExplorerItem): string {
    return item.type === 'examples' ? 'article' : 'quiz';
  }

  canManageItem(item: ExplorerItem): boolean {
    if (item.type === 'examples') {
      const example = item.raw as ExampleOverviewDTO;
      return this.isAdmin || example.adminId === this.currentUserId;
    }

    const test = item.raw as TestOverviewDTO;
    return this.isAdmin || test.adminId === this.currentUserId;
  }

  getFolderItemCount(folder: ExplorerFolder): number {
    return [...this.examples, ...this.tests].filter(item => (item.folderId ?? null) === folder.id).length;
  }

  getFolderChildrenCount(folder: ExplorerFolder): number {
    return this.folders.filter(item => item.parentId === folder.id).length;
  }

  getFolderPathLabel(folderId: string | null): string {
    const crumbs = this.buildBreadcrumbs(folderId);
    return crumbs.map(crumb => crumb.name).join(' / ');
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
        folderId: this.selectedFolderId
      },
      autoFocus: false
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  openExample(example: ExampleOverviewDTO): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(ExamplePreviewComponent, {
      width: isMobile ? '100vw' : '40vw',
      minHeight: isMobile ? '100dvh' : '40vh',
      maxHeight: isMobile ? '100dvh' : '70vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : undefined,
      data: { schoolId: this.schoolId, exampleId: example.id }
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  editExample(example: ExampleOverviewDTO): void {
    const isMobile = window.innerWidth <= 768;

    this.dialog.open(CreateExampleComponent, {
      width: isMobile ? '100vw' : 'min(96vw, 1400px)',
      maxWidth: isMobile ? '100vw' : '70vw',
      height: isMobile ? '100dvh' : '90vh',
      maxHeight: isMobile ? '100dvh' : '90vh',
      panelClass: isMobile ? 'mobile-fullscreen-dialog' : 'create-example-dialog-panel',
      data: { schoolId: this.schoolId, exampleId: example.id, folderId: example.folderId ?? null },
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
        folderId: this.selectedFolderId
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

  openItem(item: ExplorerItem): void {
    if (item.type === 'examples') {
      this.openExample(item.raw as ExampleOverviewDTO);
      return;
    }
    this.openTest(item.raw as TestOverviewDTO);
  }

  editItem(item: ExplorerItem): void {
    if (item.type === 'examples') {
      this.editExample(item.raw as ExampleOverviewDTO);
      return;
    }
    this.editTest(item.raw as TestOverviewDTO);
  }

  moveItemWithPicker(item: ExplorerItem): void {
    this.openFolderPicker(item.folderId ?? null).subscribe((targetFolderId: string | null | undefined) => {
      if (targetFolderId === undefined) return;

      if (item.type === 'examples') {
        this.moveExampleToFolder(item.raw as ExampleOverviewDTO, targetFolderId);
      } else {
        this.moveTestToFolder(item.raw as TestOverviewDTO, targetFolderId);
      }
    });
  }

  deleteItem(item: ExplorerItem): void {
    if (item.type === 'examples') {
      this.deleteExample(item.raw as ExampleOverviewDTO);
      return;
    }
    this.deleteTest(item.raw as TestOverviewDTO);
  }

  deleteTest(test: TestOverviewDTO): void {
    if (this.deletingTestIds.has(test.id)) return;

    const title = test.name || String(test.id) || this.t('school.test');
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      data: {
        title: `Test „${title}“ löschen?`,
        message: `Willst du den Test „${title}“ wirklich löschen?`,
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: 'Ich bestätige, dass dieser Test gelöscht werden soll.'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.deletingTestIds.add(test.id);
      this.service.deleteTest(test.id)
        .pipe(finalize(() => this.deletingTestIds.delete(test.id)))
        .subscribe({
          next: () => this.loadTests(),
          error: err => this.showErrorSnack(err)
        });
    });
  }

  async deleteExample(example: ExampleOverviewDTO): Promise<void> {
    if (this.deletingExampleIds.has(String(example.id))) return;

    const title = this.getExampleDeleteTitle(example);
    const usedInTests = await this.findTestsUsingExample(example.id);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 560px)',
      maxWidth: '92vw',
      data: {
        title: `Beispiel „${title}“ löschen?`,
        message: this.buildExampleDeleteMessage(title, usedInTests),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: 'Ich bestätige, dass dieses Beispiel gelöscht werden soll.'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.deletingExampleIds.add(String(example.id));
      this.service.deleteExample(example.id)
        .pipe(finalize(() => this.deletingExampleIds.delete(String(example.id))))
        .subscribe({
          next: () => {
            this.loadExamples();
            this.loadTests();
          },
          error: err => this.showErrorSnack(err)
        });
    });
  }

  private async buildFolderDeleteImpact(folder: ExplorerFolder): Promise<{
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
    externalTestsUsingContainedExamples: TestOverviewDTO[];
  }> {
    const folderIds = this.getFolderTreeIds(folder.id);
    const folderIdSet = new Set(folderIds);
    const folders = this.folders.filter(item => folderIdSet.has(item.id));
    const examples = this.examples.filter(item => folderIdSet.has(item.folderId ?? ''));
    const tests = this.tests.filter(item => folderIdSet.has(item.folderId ?? ''));
    const containedTestIds = new Set(tests.map(test => String(test.id)));
    const usedInTests = await this.findTestsUsingAnyExample(examples.map(example => example.id));
    const externalTestsUsingContainedExamples = usedInTests.filter(test => !containedTestIds.has(String(test.id)));

    return { folders, examples, tests, externalTestsUsingContainedExamples };
  }

  private buildFolderDeleteMessage(folder: ExplorerFolder, impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
    externalTestsUsingContainedExamples: TestOverviewDTO[];
  }): string {
    const childFolderCount = Math.max(impact.folders.length - 1, 0);
    const parts: string[] = [
      `Willst du den Ordner „${folder.name}“ wirklich löschen?`,
      '',
      `Dabei werden ${childFolderCount} Unterordner, ${impact.examples.length} Beispiele und ${impact.tests.length} Tests gelöscht.`
    ];

    const folderNames = impact.folders
      .filter(item => item.id !== folder.id)
      .map(item => `• Ordner: ${this.getFolderPathLabel(item.id) || item.name}`);
    const exampleNames = impact.examples.map(item => `• Beispiel: ${this.getExampleDeleteTitle(item)}`);
    const testNames = impact.tests.map(item => `• Test: ${item.name || item.id}`);
    const preview = [...folderNames, ...exampleNames, ...testNames];

    if (preview.length) {
      parts.push('', 'Inhalt:', ...preview.slice(0, 12));
      if (preview.length > 12) parts.push(`• … und ${preview.length - 12} weitere Einträge`);
    }

    if (impact.externalTestsUsingContainedExamples.length) {
      parts.push('', 'Achtung: Enthaltene Beispiele werden zusätzlich in diesen Tests verwendet:',
        ...impact.externalTestsUsingContainedExamples.slice(0, 8).map(test => `• ${test.name || test.id}`));
      if (impact.externalTestsUsingContainedExamples.length > 8) {
        parts.push(`• … und ${impact.externalTestsUsingContainedExamples.length - 8} weitere Tests`);
      }
    }

    return parts.join('\n');
  }

  private deleteFolderWithContent(folder: ExplorerFolder, impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
  }): void {
    const folderIds = impact.folders.map(item => item.id);
    const folderIdSet = new Set(folderIds);

    folderIds.forEach(id => this.deletingFolderIds.add(id));
    impact.examples.forEach(example => this.deletingExampleIds.add(String(example.id)));
    impact.tests.forEach(test => this.deletingTestIds.add(test.id));

    const deleteTests$ = impact.tests.map(test => this.service.deleteTest(test.id).pipe(catchError(error => of({ error }))));
    const deleteExamples$ = impact.examples.map(example => this.service.deleteExample(example.id).pipe(catchError(error => of({ error }))));
    const deleteFolders$ = this.sortFoldersDeepestFirst(impact.folders).map(item => this.service.deleteFolder(item.id).pipe(catchError(error => of({ error }))));

    const request$ = forkJoin([
      ...(deleteTests$.length ? deleteTests$ : [of(null)]),
      ...(deleteExamples$.length ? deleteExamples$ : [of(null)]),
      ...(deleteFolders$.length ? deleteFolders$ : [of(null)])
    ]);

    request$
      .pipe(finalize(() => {
        folderIds.forEach(id => this.deletingFolderIds.delete(id));
        impact.examples.forEach(example => this.deletingExampleIds.delete(String(example.id)));
        impact.tests.forEach(test => this.deletingTestIds.delete(test.id));
      }))
      .subscribe({
        next: results => {
          console.log(results)
          const failed = results.some(result => result && typeof result === 'object' && 'error' in result);
          if (failed) {
            this.snack.open('Ein Teil konnte nicht gelöscht werden. Bitte neu laden und erneut versuchen.', this.t('common.close'), { duration: 5000 });
          }

          this.folders = this.folders.filter(item => !folderIdSet.has(item.id));
          this.examples = this.examples.filter(item => !folderIdSet.has(item.folderId ?? ''));
          this.tests = this.tests.filter(item => !folderIdSet.has(item.folderId ?? ''));

          if (this.selectedFolderId && folderIdSet.has(this.selectedFolderId)) {
            this.selectedFolderId = folder.parentId ?? null;
          }

          this.setNavbarActions();
          this.reloadAll();
        },
        error: err => this.showErrorSnack(err)
      });
  }

  private getFolderTreeIds(rootFolderId: string): string[] {
    const result = new Set<string>([rootFolderId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const folder of this.folders) {
        if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
          result.add(folder.id);
          changed = true;
        }
      }
    }

    return [...result];
  }

  private sortFoldersDeepestFirst(folders: ExplorerFolder[]): ExplorerFolder[] {
    return [...folders].sort((a, b) => this.getFolderDepth(b.id) - this.getFolderDepth(a.id));
  }

  private getFolderDepth(folderId: string): number {
    let depth = 0;
    let current = this.folders.find(folder => folder.id === folderId) ?? null;

    while (current?.parentId) {
      depth++;
      current = this.folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return depth;
  }

  private getExampleDeleteTitle(example: ExampleOverviewDTO): string {
    return (example.instruction || example.question || String(example.id) || this.t('school.example')).trim();
  }

  private buildExampleDeleteMessage(title: string, usedInTests: TestOverviewDTO[]): string {
    const parts = [`Willst du das Beispiel „${title}“ wirklich löschen?`];

    if (usedInTests.length) {
      parts.push('', 'Dieses Beispiel ist in folgenden Tests enthalten:', ...usedInTests.slice(0, 10).map(test => `• ${test.name || test.id}`));
      if (usedInTests.length > 10) parts.push(`• … und ${usedInTests.length - 10} weitere Tests`);
    }

    return parts.join('\n');
  }

  private async findTestsUsingAnyExample(exampleIds: Array<string | number>): Promise<TestOverviewDTO[]> {
    const wantedIds = new Set(exampleIds.map(id => String(id)));
    if (!wantedIds.size) return [];

    const hydratedTests = await Promise.all(this.tests.map(test => this.getHydratedTestForDeleteCheck(test)));
    return this.tests.filter((test, index) => {
      const entries = this.extractExampleEntriesFromTest(hydratedTests[index]);
      return entries.some(entry => wantedIds.has(String(entry?.example?.id ?? entry?.id ?? entry?.exampleId ?? entry)));
    });
  }

  private async findTestsUsingExample(exampleId: string | number): Promise<TestOverviewDTO[]> {
    return this.findTestsUsingAnyExample([exampleId]);
  }

  private async getHydratedTestForDeleteCheck(test: TestOverviewDTO): Promise<any> {
    try {
      return await firstValueFrom(this.service.getTest(test.id).pipe(catchError(() => of(test))));
    } catch {
      return test;
    }
  }

  private extractExampleEntriesFromTest(test: any): any[] {
    if (!test) return [];
    if (Array.isArray(test.exampleList)) return test.exampleList;
    if (Array.isArray(test.examples)) return test.examples;
    if (Array.isArray(test.items)) return test.items;
    return [];
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
      if (result?.updated) this.loadSchool();
    });
  }

  private openFolderPicker(currentFolderId: string | null, excludeFolderId?: string) {
    const folders = [...this.folders]
      .filter(folder => !excludeFolderId || (folder.id !== excludeFolderId && !this.isDescendantFolder(folder.id, excludeFolderId)))
      .sort((a, b) =>
        this.getFolderPathLabel(a.id).localeCompare(
          this.getFolderPathLabel(b.id),
          this.translate.currentLang || 'de',
          { sensitivity: 'base' }
        )
      );

    const dialogFolders: FolderPickerItem[] = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      path: this.getFolderPathLabel(folder.id)
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
