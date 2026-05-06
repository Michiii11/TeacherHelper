import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as katex from 'katex';
import { FormsModule } from '@angular/forms';
import {catchError, finalize, firstValueFrom, forkJoin, of, Subject, Subscription, takeUntil} from 'rxjs';

import { HttpService } from '../../service/http.service';
import { CollectionDTO } from '../../model/Collection';
import { ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus } from '../../model/Example';
import { TestOverviewDTO } from '../../model/Test';
import { FolderDTO } from '../../model/Folder';

import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {MatOption, MatSelect, MatSelectTrigger} from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CreateExampleComponent } from '../../dialog/create-example/create-example.component';
import { CreateTestComponent } from '../../dialog/create-test/create-test.component';
import { TestPreviewComponent } from '../../dialog/test-preview/test-preview.component';
import { ExamplePreviewComponent } from '../../dialog/example-preview/example-preview.component';
import { CollectionSettingsComponent } from '../../dialog/collection-settings/collection-settings.component';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import {
  FolderPickerDialogComponent,
  FolderPickerItem
} from '../../dialog/folder-picker-dialog/folder-picker-dialog.component';
import { FolderNameDialogComponent } from '../../dialog/folder-name-dialog/folder-name-dialog.component';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import {NgIf} from '@angular/common'

type ExplorerItemType = 'examples' | 'tests';
type SortOption = 'nameAsc' | 'nameDesc' | 'createdDesc' | 'createdAsc' | 'authorAsc' | 'typeAsc';
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
  icon: string;
  action: () => void;
}

interface FolderNavNode extends ExplorerFolder {
  depth: number;
}

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIcon,
    MatIconButton,
    TranslatePipe,
    MatFormFieldModule,
    MatProgressBarModule,
  ],
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss'
})
export class CollectionComponent implements OnInit, OnDestroy {
  service = inject(HttpService);
  dialog = inject(MatDialog);
  translate = inject(TranslateService);
  snack = inject(MatSnackBar);
  navbarActions = inject(NavbarActionsService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroy$ = new Subject<void>();
  private readonly previewHtmlCache = new Map<string, SafeHtml>();
  private readonly collectionStatePrefix = 'collectionExplorerState';
  private readonly testExampleTypeCache = new Map<string, Set<string>>();
  private readonly loadingTestExampleTypeIds = new Set<string>();

  school: CollectionDTO = {} as CollectionDTO;
  schoolId: string | null = null;
  currentUserId: string = '';

  examples: ExampleOverviewDTO[] = [];
  tests: TestOverviewDTO[] = [];
  folders: ExplorerFolder[] = [];

  logoUrl: string | null = null;

  selectedFolderId: string | null = null;
  private _search = '';
  sort: SortOption = 'nameAsc';
  currentViewMode: ViewMode = 'grid';

  selectedItemTypes: ExplorerItemType[] = ['examples', 'tests'];
  selectedExampleTypes: string[] = [];
  selectedExampleFocuses: string[] = [];
  selectedAuthors: string[] = [];

  isFilterPopupOpen = false;
  isCreateMenuOpen = false;
  isSortPopupOpen = false;
  isSearchOpen = false;

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  draggedItem: DraggedExplorerItem | null = null;
  draggedFolder: DraggedExplorerFolder | null = null;
  dropTarget: string | null = null;

  deletingFolderIds = new Set<string>();
  deletingExampleIds = new Set<string>();
  deletingTestIds = new Set<number | string>();

  isSchoolLoading = true;

  get search(): string {
    return this._search;
  }

  set search(value: string) {
    this._search = value ?? '';
    this.persistExplorerState();
    this.previewHtmlCache.clear();
  }

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
      this.restoreExplorerState();
      this.applyFolderFromUrlOrStorage();
      this.reloadAll();
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyFolderFromUrlOrStorage();
    });

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
    this.isCreateMenuOpen = false;
    this.isSortPopupOpen = false;
    if (!this.isSearching) {
      this.isSearchOpen = false;
    }
  }

  private reloadAll(): void {
    if (!this.schoolId) {
      this.redirectToNotFound();
      return;
    }

    this.isSchoolLoading = true;
    this.navbarActions.clearAll();
    this.school = {} as CollectionDTO;
    this.examples = [];
    this.tests = [];
    this.folders = [];
    this.previewHtmlCache.clear();

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
        this.requestTestExampleTypesForFilters();
        this.setNavbarActions();
      });
  }

  private setNavbarActions(): void {
    const breadcrumbs: Array<{ labelKey?: string; route?: any[]; label?: string }> = [
      { labelKey: 'navbar.home', route: ['/home'] },
      { label: this.school.name || this.t('collection.untitled'), route: [`/collection/${this.schoolId}`] }
    ];

    this.navbarActions.setBreadcrumbs(breadcrumbs as any);
    this.navbarActions.setActions([
      {
        labelKey: 'collection.example',
        icon: 'post_add',
        variant: 'flat',
        action: () => this.openCreateExample()
      },
      {
        labelKey: 'collection.test',
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
          this.refreshExplorerData();
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


  private refreshExplorerData(): void {
    if (!this.schoolId) return;

    forkJoin({
      school: this.service.getCollectionById(this.schoolId).pipe(catchError(() => of(this.school))),
      folders: this.service.getFolders(this.schoolId).pipe(catchError(() => of(this.folders as FolderDTO[]))),
      examples: this.service.getExamples(this.schoolId).pipe(catchError(() => of(this.examples))),
      tests: this.service.getTests(this.schoolId).pipe(catchError(() => of(this.tests)))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ school, folders, examples, tests }) => {
        if (school) {
          this.school = school as CollectionDTO;
        }
        this.folders = this.normalizeFolders(folders as FolderDTO[]);
        this.examples = (examples as ExampleOverviewDTO[]).map(example => ({ ...example, folderId: example.folderId ?? null }));
        this.tests = (tests as TestOverviewDTO[]).map(test => ({ ...test, folderId: test.folderId ?? null }));
        this.ensureSelectedFolderStillExists();
        this.requestTestExampleTypesForFilters();
        this.setNavbarActions();
      });
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


  get folderNavNodes(): FolderNavNode[] {
    const sorted = [...this.folders].sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));
    const result: FolderNavNode[] = [];

    const appendChildren = (parentId: string | null, depth: number) => {
      for (const folder of sorted.filter(item => (item.parentId ?? null) === parentId)) {
        result.push({ ...folder, depth });
        appendChildren(folder.id, depth + 1);
      }
    };

    appendChildren(null, 0);
    return result;
  }

  isFolderInCurrentPath(folderId: string | null): boolean {
    if (!folderId || !this.selectedFolderId) return false;
    return this.currentBreadcrumbs.some(crumb => crumb.id === folderId);
  }

  get currentFolderLabel(): string {
    return this.currentFolder?.name || this.t('collection.root');
  }

  get explorerContextLabel(): string {
    return this.school?.name || this.t('collection.root');
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
      return this.t('collection.searchResults');
    }

    return this.currentFolder?.name || this.school.name || this.t('collection.root');
  }

  get headerSubtitle(): string {
    if (this.isSearching) {
      return this.t('collection.searchResultsInAllFolders');
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

    const searchTerm = this.search.trim();
    if (searchTerm) {
      chips.push({
        key: 'search',
        label: `${searchTerm}`,
        icon: 'search',
        action: () => {
          this.search = '';
          this.isSearchOpen = false;
        }
      });
    }

    if (this.selectedItemTypes.length < 2) {
      for (const type of this.selectedItemTypes) {
        chips.push({
          key: `type-${type}`,
          label: this.t(type === 'examples' ? 'collection.examples' : 'collection.tests'),
          icon: type === 'examples' ? 'post_add' : 'assignment',
          action: () => this.clearItemTypeFilter()
        });
      }
    }

    for (const type of this.selectedExampleTypes) {
      chips.push({
        key: `example-type-${type}`,
        label: this.getExampleTypeLabel(type),
        icon: this.getExampleTypeIcon(type),
        action: () => this.removeExampleType(type)
      });
    }

    for (const focus of this.selectedExampleFocuses) {
      chips.push({
        key: `focus-${focus}`,
        label: focus,
        icon: 'sell',
        action: () => this.removeExampleFocus(focus)
      });
    }

    for (const author of this.selectedAuthors) {
      chips.push({
        key: `author-${author}`,
        label: author,
        icon: 'person',
        action: () => this.removeAuthor(author)
      });
    }

    return chips;
  }

  get visibleFolders(): ExplorerFolder[] {
    const search = this.search.trim().toLowerCase();
    const sortFolders = (folders: ExplorerFolder[]) =>
      folders.sort((a, b) => a.name.localeCompare(b.name, this.translate.currentLang || 'de', { sensitivity: 'base' }));

    if (search) {
      return sortFolders(this.folders.filter(folder =>
        folder.name.toLowerCase().includes(search) ||
        this.getFolderPathLabel(folder.id).toLowerCase().includes(search)
      ));
    }

    let folders = this.folders.filter(folder => folder.parentId === this.selectedFolderId);

    // Nur der Beispieltyp-Filter blendet Ordner aus. Suche, Autor, Fokus usw.
    // sollen die Ordnernavigation nicht künstlich leerräumen.
    if (this.selectedExampleTypes.length) {
      folders = folders.filter(folder => this.folderTreeHasSelectedExampleType(folder.id));
    }

    return sortFolders(folders);
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
      items = items.filter(item => {
        if (item.type === 'examples') {
          return this.selectedExampleTypes.includes(String((item.raw as ExampleOverviewDTO).type));
        }

        return this.testMatchesSelectedExampleType(item.raw as TestOverviewDTO);
      });
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

  private get collectionStateStorageKey(): string {
    return `${this.collectionStatePrefix}:${this.schoolId ?? 'unknown'}`;
  }

  /**
   * Restores the lightweight explorer UI state for this collection.
   * The selected folder is also mirrored in the URL, but localStorage keeps the
   * rest of the UI comfortable after a reload: search text, filters, sorting
   * and grid/compact view.
   */
  private restoreExplorerState(): void {
    if (!this.schoolId) return;

    try {
      const raw = localStorage.getItem(this.collectionStateStorageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as Partial<{
        folderId: string | null;
        search: string;
        sort: SortOption;
        currentViewMode: ViewMode;
        selectedItemTypes: ExplorerItemType[];
        selectedExampleTypes: string[];
        selectedExampleFocuses: string[];
        selectedAuthors: string[];
      }>;

      this.selectedFolderId = typeof state.folderId === 'string' ? state.folderId : null;
      this._search = typeof state.search === 'string' ? state.search : '';
      this.sort = this.isValidSortOption(state.sort) ? state.sort : 'nameAsc';
      this.currentViewMode = state.currentViewMode === 'compact' ? 'compact' : 'grid';
      this.selectedItemTypes = this.normalizeItemTypes(state.selectedItemTypes);
      this.selectedExampleTypes = Array.isArray(state.selectedExampleTypes) ? state.selectedExampleTypes.map(String) : [];
      this.selectedExampleFocuses = Array.isArray(state.selectedExampleFocuses) ? state.selectedExampleFocuses.map(String) : [];
      this.selectedAuthors = Array.isArray(state.selectedAuthors) ? state.selectedAuthors.map(String) : [];
    } catch {
      localStorage.removeItem(this.collectionStateStorageKey);
    }
  }

  /** Saves only UI state. No collection data is written to localStorage. */
  private persistExplorerState(): void {
    if (!this.schoolId) return;

    const state = {
      folderId: this.selectedFolderId,
      search: this.search,
      sort: this.sort,
      currentViewMode: this.currentViewMode,
      selectedItemTypes: this.selectedItemTypes,
      selectedExampleTypes: this.selectedExampleTypes,
      selectedExampleFocuses: this.selectedExampleFocuses,
      selectedAuthors: this.selectedAuthors
    };

    localStorage.setItem(this.collectionStateStorageKey, JSON.stringify(state));
  }

  /**
   * URL wins for folder navigation, so links can be shared/bookmarked.
   * If there is no folder query param, the value restored from localStorage stays.
   */
  private applyFolderFromUrlOrStorage(): void {
    const folderFromUrl = this.route.snapshot.queryParamMap.get('folder');
    if (folderFromUrl !== null) {
      this.selectedFolderId = folderFromUrl && folderFromUrl !== 'root' ? folderFromUrl : null;
      this.persistExplorerState();
      this.setNavbarActions();
    }
  }

  private updateFolderQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: this.selectedFolderId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private isValidSortOption(value: unknown): value is SortOption {
    return ['nameAsc', 'nameDesc', 'createdDesc', 'createdAsc', 'authorAsc', 'typeAsc'].includes(String(value));
  }

  private normalizeItemTypes(value: unknown): ExplorerItemType[] {
    if (!Array.isArray(value)) return ['examples', 'tests'];
    const result = value.filter((item): item is ExplorerItemType => item === 'examples' || item === 'tests');
    return result.length ? [...new Set(result)] : ['examples', 'tests'];
  }

  /**
   * Folder visibility for the example-type filter.
   *
   * Normal filters such as search, author and focus should not remove folders from
   * the tree/navigation. Only the example-type filter is special: a folder stays
   * visible when the folder itself or any child folder contains a matching example.
   * Tests are checked too, because a test can contain examples of the selected type.
   */
  private folderTreeHasSelectedExampleType(folderId: string): boolean {
    const folderIds = new Set(this.getFolderTreeIds(folderId));

    const hasMatchingExample = this.selectedItemTypes.includes('examples') && this.examples.some(example =>
      folderIds.has(example.folderId ?? '') && this.exampleMatchesSelectedType(example)
    );

    const hasMatchingTest = this.selectedItemTypes.includes('tests') && this.tests.some(test =>
      folderIds.has(test.folderId ?? '') && this.testMatchesSelectedExampleType(test)
    );

    return hasMatchingExample || hasMatchingTest;
  }

  private exampleMatchesSelectedType(example: ExampleOverviewDTO): boolean {
    return !this.selectedExampleTypes.length || this.selectedExampleTypes.includes(String(example.type));
  }

  /**
   * Tests only contain all question/example details after loading the full test.
   * The overview sometimes already has enough data; otherwise we fetch the full
   * test once, cache its example types and automatically re-render when it arrives.
   */
  private testMatchesSelectedExampleType(test: TestOverviewDTO): boolean {
    if (!this.selectedExampleTypes.length) return true;

    const key = this.getTestIdKey(test);
    const cached = this.testExampleTypeCache.get(key);
    if (cached) {
      return this.selectedExampleTypes.some(type => cached.has(String(type)));
    }

    const entries = this.extractExampleEntriesFromTest(test);
    if (entries.length) {
      const types = this.getExampleTypesFromEntries(entries);
      this.testExampleTypeCache.set(key, types);
      return this.selectedExampleTypes.some(type => types.has(String(type)));
    }

    this.requestTestExampleTypes(test);
    return false;
  }

  private requestTestExampleTypesForFilters(): void {
    if (!this.selectedExampleTypes.length) return;
    for (const test of this.tests) {
      this.requestTestExampleTypes(test);
    }
  }

  private requestTestExampleTypes(test: TestOverviewDTO): void {
    const key = this.getTestIdKey(test);
    if (this.testExampleTypeCache.has(key) || this.loadingTestExampleTypeIds.has(key)) return;

    this.loadingTestExampleTypeIds.add(key);
    this.service.getTest(test.id).pipe(
      catchError(() => of(test)),
      finalize(() => this.loadingTestExampleTypeIds.delete(key)),
      takeUntil(this.destroy$)
    ).subscribe(fullTest => {
      this.testExampleTypeCache.set(key, this.getExampleTypesFromEntries(this.extractExampleEntriesFromTest(fullTest)));
    });
  }

  private getExampleTypesFromEntries(entries: any[]): Set<string> {
    const types = new Set<string>();

    for (const entry of entries) {
      const directType = this.extractExampleTypeFromEntry(entry);
      if (directType) {
        types.add(directType);
        continue;
      }

      const exampleId = entry?.example?.id ?? entry?.id ?? entry?.exampleId ?? entry;
      const knownExample = this.examples.find(example => String(example.id) === String(exampleId));
      if (knownExample?.type) {
        types.add(String(knownExample.type));
      }
    }

    return types;
  }

  private extractExampleTypeFromEntry(entry: any): string | null {
    const candidates = [
      entry?.example?.type,
      entry?.exampleType,
      entry?.type,
      entry?.question?.example?.type,
      entry?.question?.type
    ];

    const value = candidates.find(item => item !== undefined && item !== null && String(item).trim());
    return value !== undefined && value !== null ? String(value) : null;
  }

  private getTestIdKey(test: TestOverviewDTO): string {
    return String(test.id);
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
        this.requestTestExampleTypesForFilters();
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
        this.requestTestExampleTypesForFilters();
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
      collectionId: folder.collectionId,
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
      this.persistExplorerState();
      this.updateFolderQueryParam();
    }
  }

  private closeFloatingMenus(): void {
    this.isFilterPopupOpen = false;
    this.isCreateMenuOpen = false;
    this.isSortPopupOpen = false;
  }

  toggleFilterPopup(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.isFilterPopupOpen;
    this.closeFloatingMenus();
    this.isFilterPopupOpen = next;
  }

  toggleSortPopup(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.isSortPopupOpen;
    this.closeFloatingMenus();
    this.isSortPopupOpen = next;
  }

  setSort(sort: SortOption): void {
    this.sort = sort;
    this.isSortPopupOpen = false;
    this.persistExplorerState();
  }

  toggleCreateMenu(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.isCreateMenuOpen;
    this.closeFloatingMenus();
    this.isCreateMenuOpen = next;
  }

  openSearch(event?: Event): void {
    event?.stopPropagation();
    this.closeFloatingMenus();
    this.isSearchOpen = true;
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  toggleSearch(event: Event): void {
    event.stopPropagation();
    if (this.isSearchOpen || this.isSearching) {
      if (!this.search.trim()) {
        this.isSearchOpen = false;
        return;
      }
      this.search = '';
      this.isSearchOpen = false;
      return;
    }

    this.openSearch(event);
  }

  clearSearch(event: Event): void {
    event.stopPropagation();
    this.search = '';
    this.isSearchOpen = true;
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  closeSearch(): void {
    if (!this.search.trim()) {
      this.isSearchOpen = false;
    }
  }

  createFolderFromMenu(): void {
    this.isCreateMenuOpen = false;
    this.createFolder();
  }

  createExampleFromMenu(): void {
    this.isCreateMenuOpen = false;
    this.openCreateExample();
  }

  createTestFromMenu(): void {
    this.isCreateMenuOpen = false;
    this.createTest();
  }

  stopClick(event: Event): void {
    event.stopPropagation();
  }

  setCurrentViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
    this.persistExplorerState();
  }

  selectFolder(folderId: string | null): void {
    this.selectedFolderId = folderId;
    this.persistExplorerState();
    this.updateFolderQueryParam();
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
        title: this.t('collection.createFolderTitle'),
        subtitle: this.t('collection.createFolderSubtitle'),
        label: this.t('collection.folderNameLabel'),
        placeholder: this.t('collection.folderNamePlaceholder'),
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
        title: this.t('collection.renameFolderTitle'),
        subtitle: this.t('collection.renameFolderSubtitle'),
        label: this.t('collection.folderNameLabel'),
        placeholder: this.t('collection.folderNamePlaceholder'),
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
      width: 'min(92vw, 620px)',
      maxWidth: '92vw',
      data: {
        title: this.t('dialog.folderDelete.title', { name: folder.name }),
        message: this.buildFolderDeleteIntro(folder, impact),
        summaryItems: this.buildFolderDeleteSummaryItems(impact),
        sections: this.buildFolderDeleteSections(folder, impact),
        warningTitle: impact.externalTestsUsingContainedExamples.length ? this.t('dialog.folderDelete.externalUsageTitle') : undefined,
        warningText: impact.externalTestsUsingContainedExamples.length
          ? this.t('dialog.folderDelete.externalUsageText')
          : undefined,
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.t('dialog.folderDelete.confirmationText')
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

  onDropToRoot(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.handleDrop(null);
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
      this.persistExplorerState();
      return;
    }

    this.selectedItemTypes = [...this.selectedItemTypes, type];
    this.persistExplorerState();
  }


  clearItemTypeFilter(): void {
    this.selectedItemTypes = ['examples', 'tests'];
    this.persistExplorerState();
  }

  isItemTypeSelected(type: ExplorerItemType): boolean {
    return this.selectedItemTypes.includes(type);
  }

  toggleExampleType(type: string): void {
    this.selectedExampleTypes = this.selectedExampleTypes.includes(type)
      ? this.selectedExampleTypes.filter(item => item !== type)
      : [...this.selectedExampleTypes, type];
    this.persistExplorerState();
    this.requestTestExampleTypesForFilters();
  }

  isExampleTypeSelected(type: string): boolean {
    return this.selectedExampleTypes.includes(type);
  }

  removeExampleType(type: string): void {
    this.selectedExampleTypes = this.selectedExampleTypes.filter(item => item !== type);
    this.persistExplorerState();
    this.requestTestExampleTypesForFilters();
  }

  toggleExampleFocus(focus: string): void {
    this.selectedExampleFocuses = this.selectedExampleFocuses.includes(focus)
      ? this.selectedExampleFocuses.filter(item => item !== focus)
      : [...this.selectedExampleFocuses, focus];
    this.persistExplorerState();
  }

  isExampleFocusSelected(focus: string): boolean {
    return this.selectedExampleFocuses.includes(focus);
  }

  removeExampleFocus(focus: string): void {
    this.selectedExampleFocuses = this.selectedExampleFocuses.filter(item => item !== focus);
    this.persistExplorerState();
  }

  toggleAuthor(author: string): void {
    this.selectedAuthors = this.selectedAuthors.includes(author)
      ? this.selectedAuthors.filter(item => item !== author)
      : [...this.selectedAuthors, author];
    this.persistExplorerState();
  }

  isAuthorSelected(author: string): boolean {
    return this.selectedAuthors.includes(author);
  }

  removeAuthor(author: string): void {
    this.selectedAuthors = this.selectedAuthors.filter(item => item !== author);
    this.persistExplorerState();
  }

  resetFilters(): void {
    this.selectedItemTypes = ['examples', 'tests'];
    this.selectedExampleTypes = [];
    this.selectedExampleFocuses = [];
    this.selectedAuthors = [];
    this.persistExplorerState();
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
      title: example.instruction || this.t('collection.untitled'),
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
      title: test.name || this.t('collection.untitled'),
      subtitle: `${test.amountOfQuestions} ${this.t('collection.questions')} · ${this.getFolderPathLabel(test.folderId ?? null)}`,
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
        case 'typeAsc': {
          const typeOrder: Record<ExplorerItemType, number> = { examples: 0, tests: 1 };
          const typeCompare = typeOrder[a.type] - typeOrder[b.type];
          return typeCompare || a.title.localeCompare(b.title, this.translate.currentLang || 'de', { sensitivity: 'base' });
        }
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


  getRenderedPreviewTitle(item: ExplorerItem): SafeHtml {
    const fallbackTitle = this.t('collection.untitled') || 'Unbenannt';

    // Cards are intentionally a one-line preview. We cut the raw title before
    // rendering so multi-line Markdown/LaTeX cannot create hidden second rows.
    const title = this.getFirstDisplayLine(item.title || fallbackTitle);
    const cacheKey = `${item.type}-${item.id}-${title}`;
    const cached = this.previewHtmlCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const rendered = this.sanitizer.bypassSecurityTrustHtml(this.renderPreviewTitleHtml(title));
    this.previewHtmlCache.set(cacheKey, rendered);
    return rendered;
  }

  private getFirstDisplayLine(value: string | null | undefined): string {
    const source = String(value ?? '').replace(/\r\n?/g, '\n');
    const firstNonEmpty = source.split('\n').find(line => line.trim().length > 0);
    return (firstNonEmpty ?? source.split('\n')[0] ?? '').trim();
  }

  /**
   * Renders the collection-card title as inline content only.
   *
   * This deliberately does NOT call renderMarkdownHtml(), because block Markdown
   * would interpret titles like "1. Test" as an ordered list and indent them.
   * For cards we only want inline formatting (bold/italic/code/strike) plus the
   * same dollar-delimited KaTeX replacement that the example preview uses.
   */
  private renderPreviewTitleHtml(value: string | null | undefined): string {
    const source = String(value ?? '');
    const mathTokens: string[] = [];
    const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

    const textWithMathTokens = source.replace(mathPattern, (_fullMatch, displayFormula, inlineFormula) => {
      const isDisplay = displayFormula !== undefined;
      const formula = isDisplay ? displayFormula : inlineFormula;
      const token = `@@MATH_TOKEN_${mathTokens.length}@@`;
      mathTokens.push(this.renderFormula(formula, isDisplay));
      return token;
    });

    let html = this.renderInlineMarkdown(textWithMathTokens);
    mathTokens.forEach((formulaHtml, index) => {
      html = html.replace(new RegExp(`@@MATH_TOKEN_${index}@@`, 'g'), formulaHtml);
    });

    return html;
  }

  private renderMarkdownHtml(value: string | number | null | undefined): string {
    const source = String(value ?? '').replace(/\r\n?/g, '\n');
    if (!source.trim()) {
      return '';
    }

    const lines = source.split('\n');
    const blocks: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        blocks.push('<p><br></p>');
        index += 1;
        continue;
      }

      if (/^\s*```/.test(line)) {
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) {
          index += 1;
        }
        blocks.push(`<pre><code>${this.escapeHtml(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoteLines: string[] = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
          index += 1;
        }
        blocks.push(`<blockquote>${quoteLines.map(item => this.renderInlineMarkdown(item)).join('<br>')}</blockquote>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*+]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ul>${items.map(item => `<li>${this.renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ol>${items.map(item => `<li>${this.renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
        continue;
      }

      const paragraphLines: string[] = [];
      while (
        index < lines.length
        && lines[index].trim()
        && !/^\s*```/.test(lines[index])
        && !/^\s*>\s?/.test(lines[index])
        && !/^\s*[-*+]\s+/.test(lines[index])
        && !/^\s*\d+[.)]\s+/.test(lines[index])
        ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      blocks.push(`<p>${paragraphLines.map(item => this.renderInlineMarkdown(item)).join('<br>')}</p>`);
    }

    return blocks.join('');
  }

  private renderInlineMarkdown(value: string | number | null | undefined): string {
    return this.escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  }

  private renderFormula(formula: string, displayMode: boolean): string {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode,
        output: 'mathml',
        throwOnError: false,
        strict: 'ignore',
      });
    } catch {
      return this.escapeHtml(displayMode ? `$$${formula}$$` : `$${formula}$`);
    }
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  getItemTags(item: ExplorerItem): string[] {
    if (item.type !== 'examples') {
      return [];
    }

    return ((item.raw as ExampleOverviewDTO).focusList ?? [])
      .map(focus => (focus.label ?? '').trim())
      .filter(Boolean)
      .slice(0, 4);
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
    return this.t('collection.test');
  }

  getExampleTypeIcon(type: string | ExampleTypes | null | undefined): string {
    const normalized = String(type ?? '').toLowerCase();

    switch (normalized) {
      case String(ExampleTypes.OPEN).toLowerCase():
        return 'notes';
      case String(ExampleTypes.HALF_OPEN).toLowerCase():
        return 'short_text';
      case String(ExampleTypes.CONSTRUCTION).toLowerCase():
        return 'architecture';
      case String(ExampleTypes.MULTIPLE_CHOICE).toLowerCase():
        return 'checklist';
      case String(ExampleTypes.GAP_FILL).toLowerCase():
        return 'format_color_text';
      case String(ExampleTypes.ASSIGN).toLowerCase():
        return 'device_hub';
      default:
        if (normalized.includes('gap') || normalized.includes('luecke') || normalized.includes('lücke')) {
          return 'format_color_text';
        }

        if (normalized.includes('match') || normalized.includes('assign') || normalized.includes('zuord')) {
          return 'device_hub';
        }

        if (normalized.includes('multiple') || normalized.includes('choice') || normalized.includes('auswahl')) {
          return 'checklist';
        }

        if (normalized.includes('half') || normalized.includes('halb')) {
          return 'short_text';
        }

        if (normalized.includes('construction') || normalized.includes('construct') || normalized.includes('konstruk')) {
          return 'architecture';
        }

        if (normalized.includes('open') || normalized.includes('offen')) {
          return 'notes';
        }

        return 'post_add';
    }
  }

  getItemIcon(item: ExplorerItem): string {
    if (item.type === 'examples') {
      return this.getExampleTypeIcon(String((item.raw as ExampleOverviewDTO).type));
    }

    return 'quiz';
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

    const title = test.name || String(test.id) || this.t('collection.test');
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: 'min(92vw, 520px)',
      maxWidth: '92vw',
      data: {
        title: this.t('dialog.testDelete.title', { name: title }),
        message: this.t('dialog.testDelete.message', { name: title }),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.t('dialog.testDelete.confirmationText')
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
        title: this.t('dialog.exampleDelete.title', { name: title }),
        message: this.buildExampleDeleteMessage(title, usedInTests),
        confirmText: this.t('common.delete'),
        cancelText: this.t('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.t('dialog.exampleDelete.confirmationText')
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

  private buildFolderDeleteIntro(folder: ExplorerFolder, impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
    externalTestsUsingContainedExamples: TestOverviewDTO[];
  }): string {
    const childFolderCount = Math.max(impact.folders.length - 1, 0);
    const hasContent = childFolderCount > 0 || impact.examples.length > 0 || impact.tests.length > 0;

    if (!hasContent) {
      return this.t('dialog.folderDelete.emptyMessage', { name: folder.name });
    }

    return this.t('dialog.folderDelete.contentMessage', { name: folder.name });
  }

  private buildFolderDeleteSummaryItems(impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
  }) {
    const childFolderCount = Math.max(impact.folders.length - 1, 0);
    const items = [];

    if (childFolderCount > 0) {
      items.push({ icon: 'folder', label: this.t('collection.subfolders'), value: childFolderCount, tone: 'warn' as const });
    }

    if (impact.examples.length > 0) {
      items.push({ icon: 'description', label: this.t('collection.examples'), value: impact.examples.length, tone: 'warn' as const });
    }

    if (impact.tests.length > 0) {
      items.push({ icon: 'assignment', label: this.t('collection.tests'), value: impact.tests.length, tone: 'warn' as const });
    }

    return items;
  }

  private buildFolderDeleteSections(folder: ExplorerFolder, impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
    externalTestsUsingContainedExamples: TestOverviewDTO[];
  }) {
    const sections: Array<{ title: string; icon: string; items: string[]; tone?: 'default' | 'warn' | 'danger' }> = [];

    const folderItems = impact.folders
      .filter(item => item.id !== folder.id)
      .map(item => this.getFolderPathLabel(item.id) || item.name);

    if (folderItems.length) {
      sections.push({
        title: this.t('collection.subfolders'),
        icon: 'folder',
        items: folderItems,
        tone: 'warn'
      });
    }

    if (impact.examples.length) {
      sections.push({
        title: this.t('collection.examples'),
        icon: 'description',
        items: impact.examples.map(item => this.getExampleDeleteTitle(item)),
        tone: 'warn'
      });
    }

    if (impact.tests.length) {
      sections.push({
        title: this.t('collection.tests'),
        icon: 'assignment',
        items: impact.tests.map(item => item.name || String(item.id)),
        tone: 'warn'
      });
    }

    if (impact.externalTestsUsingContainedExamples.length) {
      sections.push({
        title: this.t('dialog.folderDelete.externalLinks'),
        icon: 'link_off',
        items: impact.externalTestsUsingContainedExamples.map(item => item.name || String(item.id)),
        tone: 'danger'
      });
    }

    return sections;
  }

  private deleteFolderWithContent(folder: ExplorerFolder, impact: {
    folders: ExplorerFolder[];
    examples: ExampleOverviewDTO[];
    tests: TestOverviewDTO[];
  }): void {
    const folderIds = impact.folders.map(item => item.id);

    folderIds.forEach(id => this.deletingFolderIds.add(id));
    impact.examples.forEach(example => this.deletingExampleIds.add(String(example.id)));
    impact.tests.forEach(test => this.deletingTestIds.add(test.id));

    this.service.deleteFolder(folder.id)
      .pipe(finalize(() => {
        folderIds.forEach(id => this.deletingFolderIds.delete(id));
        impact.examples.forEach(example => this.deletingExampleIds.delete(String(example.id)));
        impact.tests.forEach(test => this.deletingTestIds.delete(test.id));
      }))
      .subscribe({
        next: response => {
          const message = typeof response === 'string' && response.trim()
            ? response.trim()
            : this.t('dialog.folderDelete.deleted', { name: folder.name });

          this.showSuccessSnack(message);

          if (this.selectedFolderId && folderIds.includes(this.selectedFolderId)) {
            this.selectedFolderId = folder.parentId ?? null;
          }

          this.reloadAll();
        },
        error: err => this.showBackendSnack(err, this.t('dialog.folderDelete.deleteError'))
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

  private getExampleDeleteTitle(example: ExampleOverviewDTO): string {
    return (example.instruction || example.question || String(example.id) || this.t('collection.example')).trim();
  }

  private buildExampleDeleteMessage(title: string, usedInTests: TestOverviewDTO[]): string {
    const parts = [this.t('dialog.exampleDelete.message', { name: title })];

    if (usedInTests.length) {
      parts.push('', this.t('dialog.exampleDelete.usedInTests'), ...usedInTests.slice(0, 10).map(test => `• ${test.name || test.id}`));
      if (usedInTests.length > 10) parts.push(this.t('dialog.moreTests', { count: usedInTests.length - 10 }));
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

  private showSuccessSnack(message: string): void {
    this.snack.open(message, this.t('common.close'), {
      duration: 3500,
      verticalPosition: 'bottom',
      panelClass: ['snackbar-success']
    });
  }

  private showErrorSnack(err: any): void {
    this.showBackendSnack(err);
  }

  private showBackendSnack(err: any, fallback = this.t('dialog.backend.actionFailed')): void {
    const message = this.extractBackendMessage(err, fallback);

    this.snack.open(message, this.t('common.close'), {
      duration: 5500,
      verticalPosition: 'bottom',
      panelClass: ['snackbar-error']
    });
  }

  private extractBackendMessage(err: any, fallback: string): string {
    if (typeof err?.error === 'string' && err.error.trim()) {
      return err.error.trim();
    }

    if (err?.error?.message) {
      return String(err.error.message);
    }

    if (err?.status === 0) {
      return this.t('dialog.backend.unreachable');
    }

    if (err?.status === 403) {
      return this.t('dialog.backend.forbidden');
    }

    if (err?.status === 404) {
      return this.t('dialog.backend.notFound');
    }

    if (err?.message) {
      return String(err.message);
    }

    return fallback;
  }

  openSettings(): void {
    if (!this.isAdmin || !this.schoolId) return;

    this.dialog.open(CollectionSettingsComponent, {
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
        title: this.t('collection.folderPickerTitle'),
        subtitle: this.t('collection.folderPickerSubtitle'),
        rootLabel: this.t('collection.root'),
        currentFolderId,
        folders: dialogFolders
      }
    }).afterClosed();
  }

  getSortLabel(sort: string): string {
    switch (sort) {
      case 'nameAsc':
        return this.t('collection.sort.nameAsc');
      case 'nameDesc':
        return this.t('collection.sort.nameDesc');
      case 'createdDesc':
        return this.t('collection.sort.updatedDesc');
      case 'createdAsc':
        return this.t('collection.sort.updatedAsc');
      case 'authorAsc':
        return this.t('collection.sort.authorAsc');
      default:
        return this.t('common.sort');
    }
  }

}
