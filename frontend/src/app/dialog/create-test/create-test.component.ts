import { Component, HostListener, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

import { MatFormField } from '@angular/material/input';
import { MatInput } from '@angular/material/input';
import { MatLabel } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { Subject, takeUntil } from 'rxjs';

import { Example, ExampleDTO, ExampleTypeLabels, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, GradingLevel, TestExample, TestExampleDTO } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { TestPrintService } from '../../service/test-print.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatPseudoCheckbox } from '@angular/material/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';

type GradeMode = 'auto' | 'manual';
type GradePresetKey = 'AT' | 'DE' | 'US' | 'MITARBEIT' | 'CUSTOM';
type ExplorerFolder = {
  id: string;
  schoolId: string;
  type: 'examples' | 'tests';
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PersistedTestSettings = {
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number> | Record<string, number>;
  gradingMode?: GradeMode;
  gradingSystemName?: string;
  gradingSchema?: GradingLevel[];
  gradePercentages?: Record<number, number> | Record<string, number>;
  manualGradeMinimums?: Record<number, number> | Record<string, number>;
};

type ExamplePickerDialogData = {
  examples: ExampleDTO[];
  selectedIds: number[];
  folders: ExplorerFolder[];
};

type ExamplePickerDialogResult = {
  selectedIds: number[];
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
    MatChipsModule,
  ],
  template: `
    <div class="picker-shell">
      <div class="picker-header">
        <div>
          <h2>Beispiele auswählen</h2>
          <p>Übersichtliche Auswahl mit Ordnern, Filtern und Mehrfachauswahl.</p>
        </div>
        <div class="picker-summary">
          <span>{{ availableCount }} verfügbar</span>
          <strong>{{ workingSelection.size }} markiert</strong>
        </div>
      </div>

      <div class="picker-toolbar">
        <label class="picker-search">
          <mat-icon>search</mat-icon>
          <input
            [(ngModel)]="search"
            type="text"
            placeholder="Nach Titel, Frage, Fokus, Typ oder Pfad suchen" />
        </label>

        <div class="picker-filter-group">
          <button
            type="button"
            class="picker-filter-chip"
            [class.active]="selectedTypes.length === 0"
            (click)="clearTypes()">
            Alle Typen
          </button>
          @for (type of availableTypes; track type.value) {
            <button
              type="button"
              class="picker-filter-chip"
              [class.active]="isTypeSelected(type.value)"
              (click)="toggleType(type.value)">
              {{ type.label }}
            </button>
          }
        </div>

        @if (availableFocuses.length) {
          <div class="picker-filter-group">
            <button
              type="button"
              class="picker-filter-chip"
              [class.active]="selectedFocuses.length === 0"
              (click)="clearFocuses()">
              Alle Schwerpunkte
            </button>
            @for (focus of availableFocuses; track focus) {
              <button
                type="button"
                class="picker-filter-chip"
                [class.active]="isFocusSelected(focus)"
                (click)="toggleFocus(focus)">
                {{ focus }}
              </button>
            }
          </div>
        }
      </div>

      <div class="picker-layout">
        <aside class="picker-sidebar">
          <div class="picker-sidebar-title">Ordner</div>

          <button
            type="button"
            class="folder-chip"
            [class.active]="selectedFolderId === null"
            (click)="selectedFolderId = null">
            Root
          </button>

          @for (folder of orderedFolders; track folder.id) {
            <button
              type="button"
              class="folder-chip"
              [class.active]="selectedFolderId === folder.id"
              (click)="selectedFolderId = folder.id">
              <span class="folder-chip-name">{{ folder.name }}</span>
              <span class="folder-chip-path">{{ getFolderPathLabel(folder.id) }}</span>
            </button>
          }
        </aside>

        <div class="picker-list-wrap">
          @if (selectedTypes.length || selectedFocuses.length || selectedFolderId !== null || search.trim()) {
            <div class="active-filters">
              @if (selectedFolderId !== null) {
                <span class="active-filter">Ordner: {{ getFolderPathLabel(selectedFolderId) }}</span>
              }
              @for (type of selectedTypes; track type) {
                <span class="active-filter">{{ getTypeLabel(type) }}</span>
              }
              @for (focus of selectedFocuses; track focus) {
                <span class="active-filter">{{ focus }}</span>
              }
              @if (search.trim()) {
                <span class="active-filter">Suche: {{ search.trim() }}</span>
              }
            </div>
          }

          <div class="picker-list">
            @for (example of filteredExamples; track example.id) {
              <label class="picker-row" [class.disabled]="isAlreadySelected(example.id)">
                <mat-checkbox
                  [checked]="workingSelection.has(example.id)"
                  [disabled]="isAlreadySelected(example.id)"
                  (change)="toggleExample(example.id, $event.checked)">
                </mat-checkbox>

                <div class="picker-row-copy">
                  <div class="picker-row-head">
                    <strong>{{ getExampleTitle(example) }}</strong>
                    <div class="picker-row-meta-right">
                      <span class="type-badge">{{ getTypeLabel(example.type) }}</span>
                      @if (isAlreadySelected(example.id)) {
                        <span class="state-badge muted">Schon hinzugefügt</span>
                      } @else if (workingSelection.has(example.id)) {
                        <span class="state-badge">Ausgewählt</span>
                      }
                    </div>
                  </div>

                  @if (example.question && example.instruction && example.question !== example.instruction) {
                    <p class="picker-row-text muted">{{ example.question }}</p>
                  }

                  <div class="picker-row-subline">
                    <span>{{ getFolderPathLabel(example.folderId ?? null) }}</span>
                    @if (example.admin.username || example.adminUsername) {
                      <span>· {{ example.admin.username || example.adminUsername }}</span>
                    }
                  </div>

                  @if (example.focusList.length) {
                    <div class="picker-focus-list">
                      @for (focus of example.focusList; track focus.label) {
                        <span class="focus-badge">{{ focus.label }}</span>
                      }
                    </div>
                  }
                </div>
              </label>
            } @empty {
              <div class="picker-empty">
                <mat-icon>filter_alt_off</mat-icon>
                <h3>Keine Beispiele gefunden</h3>
                <p>Probier andere Filter, eine andere Suche oder einen anderen Ordner.</p>
              </div>
            }
          </div>
        </div>
      </div>

      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" (click)="close()">Abbrechen</button>
        <button mat-flat-button color="primary" type="button" (click)="confirm()">
          Fertig ({{ workingSelection.size }})
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--text);
    }

    .picker-shell {
      width: min(1180px, 92vw);
      max-height: min(88vh, 980px);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.2rem;
      background: var(--menu-bg);
      border-radius: 22px;
      border: 1px solid color-mix(in srgb, var(--text-soft) 14%, transparent);
    }

    .picker-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .picker-header h2 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 800;
    }

    .picker-header p {
      margin: 0.3rem 0 0;
      color: var(--text-soft);
    }

    .picker-summary {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.2rem;
      padding: 0.85rem 1rem;
      min-width: 160px;
      border-radius: 16px;
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--text-soft) 16%, transparent);
    }

    .picker-summary span {
      font-size: 0.82rem;
      color: var(--text-soft);
    }

    .picker-summary strong {
      font-size: 1.15rem;
    }

    .picker-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .picker-search {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.8rem 0.95rem;
      background: var(--surface);
    }

    .picker-search input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text);
      font: inherit;
    }

    .picker-filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .picker-filter-chip,
    .folder-chip,
    .active-filter {
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      padding: 0.55rem 0.85rem;
      font: inherit;
    }

    .picker-filter-chip.active,
    .folder-chip.active {
      background: color-mix(in srgb, var(--primary) 16%, var(--surface));
      border-color: color-mix(in srgb, var(--primary) 42%, var(--border));
      color: var(--text);
    }

    .picker-layout {
      min-height: 0;
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 1rem;
      flex: 1;
    }

    .picker-sidebar,
    .picker-list {
      min-height: 0;
      overflow: auto;
    }

    .picker-sidebar {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 0.2rem;
    }

    .picker-sidebar-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-soft);
      margin-bottom: 0.2rem;
    }

    .folder-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      width: 100%;
      cursor: pointer;
    }

    .folder-chip-name {
      font-weight: 700;
    }

    .folder-chip-path {
      font-size: 0.78rem;
      color: var(--text-soft);
      margin-top: 0.18rem;
      line-height: 1.35;
    }

    .picker-list-wrap {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .active-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .active-filter {
      padding: 0.35rem 0.7rem;
      font-size: 0.78rem;
    }

    .picker-list {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      padding-right: 0.2rem;
    }

    .picker-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.85rem;
      align-items: flex-start;
      padding: 0.95rem 1rem;
      border-radius: 18px;
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--text-soft) 16%, transparent);
      cursor: pointer;
    }

    .picker-row.disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }

    .picker-row-copy {
      min-width: 0;
    }

    .picker-row-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.8rem;
    }

    .picker-row-head strong {
      line-height: 1.4;
    }

    .picker-row-meta-right {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.45rem;
    }

    .picker-row-text,
    .picker-row-subline {
      margin: 0.35rem 0 0;
      color: var(--text-soft);
      line-height: 1.45;
    }

    .picker-row-subline {
      font-size: 0.84rem;
    }

    .picker-focus-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.55rem;
    }

    .focus-badge,
    .type-badge,
    .state-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0.16rem 0.65rem;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      border: 1px solid color-mix(in srgb, var(--primary) 14%, transparent);
      color: var(--primary);
    }

    .type-badge {
      background: color-mix(in srgb, var(--surface-2) 94%, transparent);
      color: var(--text);
      border-color: var(--border);
    }

    .state-badge {
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      border-color: color-mix(in srgb, var(--primary) 30%, transparent);
      color: var(--text);
    }

    .state-badge.muted {
      background: color-mix(in srgb, var(--text-soft) 12%, transparent);
      border-color: color-mix(in srgb, var(--text-soft) 20%, transparent);
      color: var(--text-soft);
    }

    .muted {
      color: var(--text-soft);
    }

    .picker-empty {
      padding: 2rem 1rem;
      border-radius: 18px;
      border: 1px dashed var(--border);
      text-align: center;
      color: var(--text-soft);
    }

    .picker-empty h3 {
      color: var(--text);
      margin: 0.65rem 0 0.35rem;
    }

    @media (max-width: 900px) {
      .picker-shell {
        width: min(100vw, 100vw);
        max-height: 100dvh;
        border-radius: 0;
        padding: 1rem;
      }

      .picker-header,
      .picker-row-head {
        flex-direction: column;
      }

      .picker-summary,
      .picker-row-meta-right {
        align-items: flex-start;
      }

      .picker-layout {
        grid-template-columns: 1fr;
      }

      .picker-sidebar {
        max-height: 180px;
      }
    }
  `]
})
export class ExamplePickerDialogComponent implements OnInit {
  readonly workingSelection = new Set<number>();
  search = '';
  selectedFolderId: string | null = null;
  selectedTypes: string[] = [];
  selectedFocuses: string[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExamplePickerDialogData,
    private readonly dialogRef: MatDialogRef<ExamplePickerDialogComponent, ExamplePickerDialogResult>
  ) {}

  ngOnInit(): void {
    this.data.selectedIds.forEach(id => this.workingSelection.add(id));
  }

  get orderedFolders(): ExplorerFolder[] {
    return [...(this.data.folders ?? [])]
      .filter(folder => folder.type === 'examples')
      .sort((a, b) => this.getFolderPathLabel(a.id).localeCompare(this.getFolderPathLabel(b.id), 'de', { sensitivity: 'base' }));
  }

  get availableTypes(): { value: string; label: string }[] {
    const values = new Set<string>();
    for (const example of this.data.examples ?? []) {
      if (example?.type != null) {
        values.add(String(example.type));
      }
    }

    return [...values]
      .sort((a, b) => this.getTypeLabel(a).localeCompare(this.getTypeLabel(b), 'de', { sensitivity: 'base' }))
      .map(value => ({ value, label: this.getTypeLabel(value) }));
  }

  get availableFocuses(): string[] {
    const focuses = new Set<string>();
    for (const example of this.data.examples ?? []) {
      for (const focus of example.focusList ?? []) {
        const label = (focus.label ?? '').trim();
        if (label) focuses.add(label);
      }
    }
    return [...focuses].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }

  get filteredExamples(): ExampleDTO[] {
    const query = this.normalize(this.search);

    return [...(this.data.examples ?? [])]
      .filter(example => {
        if (this.selectedFolderId !== null && (example.folderId ?? null) !== this.selectedFolderId) {
          return false;
        }

        if (this.selectedTypes.length && !this.selectedTypes.includes(String(example.type))) {
          return false;
        }

        if (this.selectedFocuses.length) {
          const focusLabels = (example.focusList ?? []).map(f => this.normalize(f.label ?? ''));
          if (!this.selectedFocuses.some(focus => focusLabels.includes(this.normalize(focus)))) {
            return false;
          }
        }

        if (!query) {
          return true;
        }

        return this.matchesQuery(example, query);
      })
      .sort((a, b) => {
        const pathCompare = this.getFolderPathLabel(a.folderId ?? null).localeCompare(this.getFolderPathLabel(b.folderId ?? null), 'de', { sensitivity: 'base' });
        if (pathCompare !== 0) return pathCompare;
        return this.getExampleTitle(a).localeCompare(this.getExampleTitle(b), 'de', { sensitivity: 'base' });
      });
  }

  get availableCount(): number {
    return (this.data.examples ?? []).filter(example => !this.isAlreadySelected(example.id)).length;
  }

  toggleExample(exampleId: number, checked: boolean): void {
    if (this.isAlreadySelected(exampleId)) return;
    if (checked) {
      this.workingSelection.add(exampleId);
    } else {
      this.workingSelection.delete(exampleId);
    }
  }

  isAlreadySelected(exampleId: number): boolean {
    return this.data.selectedIds.includes(exampleId);
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes.includes(type);
  }

  isFocusSelected(focus: string): boolean {
    return this.selectedFocuses.includes(focus);
  }

  toggleType(type: string): void {
    this.selectedTypes = this.selectedTypes.includes(type)
      ? this.selectedTypes.filter(item => item !== type)
      : [...this.selectedTypes, type];
  }

  toggleFocus(focus: string): void {
    this.selectedFocuses = this.selectedFocuses.includes(focus)
      ? this.selectedFocuses.filter(item => item !== focus)
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
    return instruction || question || `Beispiel #${example.id}`;
  }

  getTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    const normalized = String(type) as ExampleTypes;
    return ExampleTypeLabels[normalized] ?? this.prettyEnumLabel(String(type));
  }

  getFolderPathLabel(folderId: string | null): string {
    if (folderId === null) return 'Root';

    const crumbs: string[] = [];
    const folders = this.data.folders ?? [];
    let current = folders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      crumbs.unshift(current.name);
      current = folders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return crumbs.length ? ['Root', ...crumbs].join(' / ') : 'Root';
  }

  confirm(): void {
    const result = [...this.workingSelection].filter(id => !this.data.selectedIds.includes(id));
    this.dialogRef.close({ selectedIds: result });
  }

  close(): void {
    this.dialogRef.close();
  }

  private matchesQuery(example: ExampleDTO, query: string): boolean {
    const focusLabels = (example.focusList ?? []).map(focus => focus.label ?? '').join(' ');
    const haystack = this.normalize([
      example.question,
      example.instruction,
      example.admin?.username ?? '',
      (example as any).adminUsername ?? '',
      String(example.id),
      this.getTypeLabel(example.type),
      focusLabels,
      this.getFolderPathLabel(example.folderId ?? null)
    ].join(' '));

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

@Component({
  selector: 'app-create-test',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogActions,
    CdkTextareaAutosize,
    MatFormField,
    MatInput,
    MatLabel,
    MatIconModule,
    MatDividerModule,
    MatIconButton,
    MatPseudoCheckbox,
    MatButtonToggle,
    MatButtonToggleGroup,
  ],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.scss',
})
export class CreateTestComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: number; testId?: number; folderId?: string | null }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateTestComponent>);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private service = inject(HttpService);
  private testPrintService = inject(TestPrintService);
  private readonly destroy$ = new Subject<void>();

  showAdvancedSettings = false;
  printCopies = 1;
  includeSolutionSheet = false;
  readonly defaultImageWidth = 320;
  isExportingPdf = false;
  isExportingWord = false;
  isSaving = false;

  allExamples: ExampleDTO[] = [];
  exampleFolders: ExplorerFolder[] = [];
  selectedExamplesInternal: TestExampleDTO[] = [];

  test: CreateTestDTO & PersistedTestSettings = {
    authToken: '',
    schoolId: this.data.schoolId,
    name: '',
    note: '',
    exampleList: [] as TestExample[],
    duration: 0,
    defaultTaskSpacing: 48,
    taskSpacingMap: {},
    gradingMode: 'auto',
    gradingSystemName: 'Österreich 1–5',
    gradingSchema: [],
    gradePercentages: {},
    manualGradeMinimums: {}
  };

  hasUnsavedChanges = false;
  isEditMode = false;

  defaultTaskSpacing = 48;
  spacingForAll = 48;
  taskSpacingMap: Record<number, number> = {};

  useAutomaticGrading = true;
  gradingSystemName = 'Österreich 1–5';
  gradingSchema: GradingLevel[] = [];

  readonly gradingPresets: Record<GradePresetKey, { name: string; levels: Omit<GradingLevel, 'order'>[] }> = {
    AT: {
      name: 'Österreich 1–5',
      levels: [
        { key: '1', label: 'Sehr gut', shortLabel: '1', percentageFrom: 90, minimumPoints: 18 },
        { key: '2', label: 'Gut', shortLabel: '2', percentageFrom: 78, minimumPoints: 16 },
        { key: '3', label: 'Befriedigend', shortLabel: '3', percentageFrom: 65, minimumPoints: 13 },
        { key: '4', label: 'Genügend', shortLabel: '4', percentageFrom: 50, minimumPoints: 10 },
        { key: '5', label: 'Nicht genügend', shortLabel: '5', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    DE: {
      name: 'Deutschland 1–6',
      levels: [
        { key: '1', label: 'Sehr gut', shortLabel: '1', percentageFrom: 92, minimumPoints: 18 },
        { key: '2', label: 'Gut', shortLabel: '2', percentageFrom: 81, minimumPoints: 16 },
        { key: '3', label: 'Befriedigend', shortLabel: '3', percentageFrom: 67, minimumPoints: 13 },
        { key: '4', label: 'Ausreichend', shortLabel: '4', percentageFrom: 50, minimumPoints: 10 },
        { key: '5', label: 'Mangelhaft', shortLabel: '5', percentageFrom: 30, minimumPoints: 6 },
        { key: '6', label: 'Ungenügend', shortLabel: '6', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    US: {
      name: 'USA A–F',
      levels: [
        { key: 'A', label: 'Excellent', shortLabel: 'A', percentageFrom: 90, minimumPoints: 18 },
        { key: 'B', label: 'Good', shortLabel: 'B', percentageFrom: 80, minimumPoints: 16 },
        { key: 'C', label: 'Satisfactory', shortLabel: 'C', percentageFrom: 70, minimumPoints: 14 },
        { key: 'D', label: 'Passing', shortLabel: 'D', percentageFrom: 60, minimumPoints: 12 },
        { key: 'F', label: 'Fail', shortLabel: 'F', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    MITARBEIT: {
      name: 'Mitarbeit ++ bis --',
      levels: [
        { key: 'plusplus', label: 'Sehr aktiv', shortLabel: '++', percentageFrom: 90, minimumPoints: 18 },
        { key: 'plus', label: 'Aktiv', shortLabel: '+', percentageFrom: 75, minimumPoints: 15 },
        { key: 'neutral', label: 'In Ordnung', shortLabel: 'o', percentageFrom: 55, minimumPoints: 11 },
        { key: 'minus', label: 'Wenig Mitarbeit', shortLabel: '-', percentageFrom: 30, minimumPoints: 6 },
        { key: 'minusminus', label: 'Keine Mitarbeit', shortLabel: '--', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    CUSTOM: {
      name: 'Eigenes Schema',
      levels: [
        { key: 'top', label: 'Top', shortLabel: 'Top', percentageFrom: 90, minimumPoints: 18 },
        { key: 'mid', label: 'Mittel', shortLabel: 'Mid', percentageFrom: 60, minimumPoints: 12 },
        { key: 'low', label: 'Niedrig', shortLabel: 'Low', percentageFrom: 0, minimumPoints: 0 },
      ]
    }
  };

  protected readonly ExampleTypes = ExampleTypes;

  constructor() {
    this.dialogRef.disableClose = true;
    this.applyGradingPreset('AT', false);

    this.dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeDialog());

    this.dialogRef.keydownEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        if (event.key === 'Escape') this.closeDialog();
      });
  }

  ngOnInit(): void {
    if (this.data.testId) {
      this.service.getCreateTest(this.data.testId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            this.test = {
              ...this.test,
              ...response,
            };
            this.isEditMode = true;
            const hydratedEntries = this.hydrateConstructionImagesForEntries(this.test.exampleList ?? []);
            this.selectedExamplesInternal = hydratedEntries;
            this.test.exampleList = hydratedEntries;
            this.hydratePersistedSettings(response);
            this.initializeTaskSpacing();
            this.hasUnsavedChanges = false;
          },
        });
    }

    this.service.getFullExamples(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((examples) => {
        this.allExamples = this.hydrateConstructionImagesForExamples(examples as ExampleDTO[]);
      });

    this.service.getExampleFolders(String(this.data.schoolId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (folders: any) => {
          this.exampleFolders = (folders ?? []).map((folder: any) => ({
            ...folder,
            type: 'examples',
            parentId: folder.parentId ?? null,
          }));
        },
        error: () => {
          this.exampleFolders = [];
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleAdvancedSettings(): void {
    this.showAdvancedSettings = !this.showAdvancedSettings;
  }

  onPrintCopiesChange(value: number | string | null): void {
    const parsed = Math.round(Number(value ?? 1));
    this.printCopies = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1;
  }

  setIncludeSolutionSheet(value: boolean): void {
    this.includeSolutionSheet = value;
  }

  addExampleToSelection(example: Example | ExampleDTO): void {
    const current = this.selectedExamplesInternal;
    if (current.some((x) => x.example?.id === example.id)) return;

    const hydratedExample = this.hydrateConstructionImage(example);

    const newEntry: TestExample = {
      id: -1,
      example: hydratedExample,
      points: 0,
      title: '',
      test: undefined as any,
    };

    const next: TestExampleDTO[] = [...current, newEntry];
    this.selectedExamplesInternal = next;
    this.syncSelectionToTest(next);
    this.taskSpacingMap[example.id] = this.defaultTaskSpacing;

    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }

    this.markDirty();
  }

  removeSelectedExample(entry: TestExampleDTO): void {
    const next = this.selectedExamplesInternal.filter((x) => x.example.id !== entry.example.id);
    this.selectedExamplesInternal = next;
    this.syncSelectionToTest(next);
    delete this.taskSpacingMap[entry.example.id];

    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }

    this.markDirty();
  }

  get selectedExamples(): TestExampleDTO[] {
    return this.selectedExamplesInternal;
  }

  get totalPoints(): number {
    return this.selectedExamples.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
  }

  get gradeHeaderLabel(): string {
    const name = this.normalize(this.gradingSystemName);
    if (name.includes('usa') || name.includes('a–f') || name.includes('a-f')) return 'Grade';
    if (name.includes('mitarbeit') || name.includes('feedback')) return 'Bewertung';
    return 'Note';
  }

  get gradeTableHeading(): string {
    return this.useAutomaticGrading ? 'ab %' : 'ab Punkten';
  }

  getExampleHeading(example: Example | ExampleDTO): string {
    return example.instruction?.trim() || example.question?.trim() || `Beispiel #${example.id}`;
  }

  getExampleMeta(entry: TestExampleDTO): string {
    const focusLabels = (entry.example.focusList ?? [])
      .map(focus => focus.label)
      .filter(Boolean)
      .join(', ');

    const parts = [
      this.getExampleTypeLabel(entry.example.type),
      this.getFolderPathLabel(entry.example.folderId ?? null),
      focusLabels || ''
    ].filter(Boolean);

    return parts.join(' · ');
  }

  getExampleTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    return ExampleTypeLabels[type as ExampleTypes] ?? String(type);
  }

  getFolderPathLabel(folderId: string | null): string {
    if (folderId === null) return 'Root';

    const crumbs: string[] = [];
    let current = this.exampleFolders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      crumbs.unshift(current.name);
      current = this.exampleFolders.find(folder => folder.id === current?.parentId) ?? null;
    }

    return crumbs.length ? ['Root', ...crumbs].join(' / ') : 'Root';
  }

  saveTest(): void {
    this.test.authToken = localStorage.getItem('teacher_authToken') || '';
    this.test.schoolId = Number(this.test.schoolId || this.data.schoolId);
    this.test.exampleList = this.selectedExamplesInternal;
    (this.test as any).folderId = this.data.folderId ?? (this.test as any).folderId ?? null;

    if (this.isSaving) {
      return;
    }

    this.isSaving = true;

    this.attachPersistedSettingsToPayload();

    const request = this.isEditMode
      ? this.service.saveTest(this.data.testId, this.test)
      : this.service.createTest(this.test);

    request
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEditMode ? 'Test erfolgreich gespeichert' : 'Test erfolgreich erstellt',
            'OK',
            { duration: 3000 }
          );
          this.hasUnsavedChanges = false;
          this.dialogRef.close(this.test);

          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
          this.snackBar.open('Speichern fehlgeschlagen.', 'OK', { duration: 3000 });
        }
      });
  }

  async exportPdf(): Promise<void> {
    if (!this.selectedExamples.length) {
      this.snackBar.open('Bitte zuerst mindestens eine Aufgabe auswählen.', 'OK', { duration: 2500 });
      return;
    }

    this.attachPersistedSettingsToPayload();
    this.isExportingPdf = true;

    const success = await this.testPrintService.exportPdf(this.test, this.selectedExamples, {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
    });

    this.isExportingPdf = false;

    this.snackBar.open(
      success ? 'PDF wurde heruntergeladen.' : 'PDF-Export fehlgeschlagen.',
      'OK',
      { duration: 3000 }
    );
  }

  async exportWord(): Promise<void> {
    if (!this.selectedExamples.length) {
      this.snackBar.open('Bitte zuerst mindestens eine Aufgabe auswählen.', 'OK', { duration: 2500 });
      return;
    }

    this.attachPersistedSettingsToPayload();
    this.isExportingWord = true;

    const success = await this.testPrintService.exportWord(this.test, this.selectedExamples, {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
    });

    this.isExportingWord = false;

    this.snackBar.open(
      success ? 'Word-Datei wurde heruntergeladen.' : 'Word-Export fehlgeschlagen.',
      'OK',
      { duration: 3000 }
    );
  }

  async closeDialog(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Warnung',
          message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.',
          cancelText: 'Abbrechen',
          confirmText: 'Schließen',
        },
      });

      const confirmed = await confirmRef.afterClosed().toPromise();
      if (!confirmed) return;
    }

    this.dialogRef.close();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
    this.attachPersistedSettingsToPayload();
  }

  onPointsChanged(): void {
    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }
    this.markDirty();
  }

  onTaskSpacingChange(exampleId: number, value: number | string | null): void {
    const numeric = this.normalizeSpacingValue(value);
    this.taskSpacingMap[exampleId] = numeric;
    this.markDirty();
  }

  onDefaultSpacingChanged(value: number | string | null): void {
    this.defaultTaskSpacing = this.normalizeSpacingValue(value);
    this.spacingForAll = this.defaultTaskSpacing;
    this.markDirty();
  }

  applySpacingToAll(): void {
    const spacing = this.normalizeSpacingValue(this.spacingForAll);

    for (const entry of this.selectedExamples) {
      this.taskSpacingMap[entry.example.id] = spacing;
    }

    this.defaultTaskSpacing = spacing;
    this.spacingForAll = spacing;
    this.markDirty();
  }

  getTaskSpacing(exampleId: number): number {
    return this.taskSpacingMap[exampleId] ?? this.defaultTaskSpacing;
  }

  resetTaskSpacing(): void {
    for (const entry of this.selectedExamples) {
      this.taskSpacingMap[entry.example.id] = this.defaultTaskSpacing;
    }

    this.spacingForAll = this.defaultTaskSpacing;
    this.markDirty();
  }

  onGradingModeChange(mode: GradeMode): void {
    this.useAutomaticGrading = mode === 'auto';
    if (this.useAutomaticGrading) {
      this.normalizeAutomaticThresholds();
    } else {
      this.normalizeManualThresholds();
    }
    this.markDirty();
  }

  applyGradingPreset(preset: GradePresetKey, shouldMarkDirty = true): void {
    const config = this.gradingPresets[preset];
    this.gradingSystemName = config.name;
    this.gradingSchema = config.levels.map((level, index) => ({
      ...level,
      order: index,
    }));
    this.normalizeCurrentThresholds();
    if (shouldMarkDirty) {
      this.markDirty();
    } else {
      this.attachPersistedSettingsToPayload();
    }
  }

  addGradingLevel(): void {
    const nextIndex = this.gradingSchema.length;
    const previous = this.gradingSchema[nextIndex - 1];
    const threshold = this.useAutomaticGrading
      ? Math.max(0, (previous?.percentageFrom ?? 0) - 10)
      : Math.max(0, (previous?.minimumPoints ?? 0) - 1);

    this.gradingSystemName = this.gradingSystemName || 'Eigenes Schema';
    this.gradingSchema = [
      ...this.gradingSchema,
      {
        key: `level-${Date.now()}-${nextIndex}`,
        label: `Stufe ${nextIndex + 1}`,
        shortLabel: `${nextIndex + 1}`,
        order: nextIndex,
        percentageFrom: this.useAutomaticGrading ? threshold : 0,
        minimumPoints: this.useAutomaticGrading ? 0 : threshold,
      }
    ];
    this.normalizeCurrentThresholds();
    this.markDirty();
  }

  removeGradingLevel(index: number): void {
    if (this.gradingSchema.length <= 2) {
      this.snackBar.open('Mindestens zwei Bewertungsstufen sollten bestehen bleiben.', 'OK', { duration: 2500 });
      return;
    }

    this.gradingSchema = this.gradingSchema
      .filter((_, i) => i !== index)
      .map((level, i) => ({ ...level, order: i }));

    this.normalizeCurrentThresholds();
    this.markDirty();
  }

  moveGradingLevel(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.gradingSchema.length) return;

    const next = [...this.gradingSchema];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;

    this.gradingSchema = next.map((level, i) => ({ ...level, order: i }));
    this.normalizeCurrentThresholds();
    this.markDirty();
  }

  onGradingSystemNameChanged(value: string): void {
    this.gradingSystemName = value?.trim() || 'Eigenes Schema';
    this.markDirty();
  }

  onLevelChanged(): void {
    this.normalizeCurrentThresholds();
    this.markDirty();
  }

  normalizeCurrentThresholds(): void {
    if (this.useAutomaticGrading) {
      this.normalizeAutomaticThresholds();
    } else {
      this.normalizeManualThresholds();
    }
  }

  normalizeAutomaticThresholds(): void {
    let last = 100;

    this.gradingSchema = this.gradingSchema.map((level, index) => {
      const raw = Number(level.percentageFrom ?? (index === this.gradingSchema.length - 1 ? 0 : last));
      const normalized = index === this.gradingSchema.length - 1
        ? 0
        : Math.max(0, Math.min(last, Math.round(raw)));

      last = normalized;
      return {
        ...level,
        order: index,
        percentageFrom: normalized,
      };
    });

    if (this.gradingSchema.length) {
      this.gradingSchema[this.gradingSchema.length - 1].percentageFrom = 0;
    }
  }

  normalizeManualThresholds(): void {
    const total = this.totalPoints;
    let last = total;

    this.gradingSchema = this.gradingSchema.map((level, index) => {
      const raw = Number(level.minimumPoints ?? (index === this.gradingSchema.length - 1 ? 0 : last));
      const normalized = index === this.gradingSchema.length - 1
        ? 0
        : Math.max(0, Math.min(last, Math.round(raw)));

      last = normalized;

      return {
        ...level,
        order: index,
        minimumPoints: normalized,
      };
    });

    if (this.gradingSchema.length) {
      this.gradingSchema[this.gradingSchema.length - 1].minimumPoints = 0;
    }
  }

  resetGrading(): void {
    this.applyGradingPreset('AT');
  }

  getGradeMinimumByIndex(index: number): number {
    if (!this.gradingSchema[index]) return 0;

    if (this.useAutomaticGrading) {
      const percentage = Number(this.gradingSchema[index].percentageFrom ?? 0);
      return Math.max(0, Math.min(this.totalPoints, Math.ceil(this.totalPoints * (percentage / 100))));
    }

    return Math.max(0, Math.min(this.totalPoints, Math.round(Number(this.gradingSchema[index].minimumPoints ?? 0))));
  }

  getGradeRangeLabelByIndex(index: number): string {
    const total = this.totalPoints;
    if (total <= 0) return '–';
    if (!this.gradingSchema[index]) return '–';

    const min = this.getGradeMinimumByIndex(index);
    const upper = index === 0 ? total : this.getGradeMinimumByIndex(index - 1) - 1;

    if (upper < min) return `${min}`;
    if (upper === min) return `${min}`;
    return `${upper}-${min}`;
  }

  getPreviewImage(example: Example | ExampleDTO): string | null {
    return (example as any).imageUrl || (example as any).image || null;
  }

  getImageWidth(example: Example | ExampleDTO): number {
    return this.normalizeImageWidth((example as any).imageWidth);
  }

  getQuestionWithGapLabels(example: Example | ExampleDTO): string {
    let idx = 0;
    return example.question.replace(/\{Lücke \d+\}/g, () => {
      const label = example.gaps[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  printPreview(): void {
    this.attachPersistedSettingsToPayload();
    this.testPrintService.printTest(this.test, this.selectedExamples, {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
    });
  }

  private hydrateConstructionImagesForExamples(examples: ExampleDTO[]): ExampleDTO[] {
    return (examples ?? []).map(example => this.hydrateConstructionImage(example) as unknown as ExampleDTO);
  }

  private hydrateConstructionImagesForEntries(entries: TestExampleDTO[]): TestExampleDTO[] {
    return (entries ?? []).map(entry => ({
      ...entry,
      example: this.hydrateConstructionImage(entry.example)
    }));
  }

  private hydrateConstructionImage(example: Example | ExampleDTO): Example {
    if (!example || example.type !== ExampleTypes.CONSTRUCTION || !example.id) {
      return <Example>example;
    }

    const normalizedExample = this.toExample(example);
    const hasTaskImage = !!((normalizedExample as any).imageUrl || (normalizedExample as any).image);
    const hasSolutionImage = !!((normalizedExample as any).solutionUrl);

    return {
      ...normalizedExample,
      imageUrl: hasTaskImage ? (this.service.getConstructionImageUrl(normalizedExample.id) ?? '') : '',
      image: hasTaskImage ? (this.service.getConstructionImageUrl(normalizedExample.id) ?? '') : '',
      solutionUrl: hasSolutionImage ? (this.service.getConstructionSolutionImageUrl(normalizedExample.id) ?? '') : ''
    } as Example & { image?: string };
  }

  private toExample(example: Example | ExampleDTO): Example {
    return {
      ...(example as any),
      admin: (example as any).admin as any,
      focusList: [...((example as any).focusList ?? [])],
      answers: (example as any).answers ?? [],
      options: (example as any).options ?? [],
      gaps: (example as any).gaps ?? [],
      assigns: (example as any).assigns ?? [],
      assignRightItems: (example as any).assignRightItems ?? [],
      imageUrl: (example as any).imageUrl ?? null,
      solutionUrl: (example as any).solutionUrl ?? null,
      imageWidth: (example as any).imageWidth ?? null,
      solutionImageWidth: (example as any).solutionImageWidth ?? null,
    } as Example;
  }

  private syncSelectionToTest(selected: TestExampleDTO[]): void {
    this.test.exampleList = [...selected];
  }

  private initializeTaskSpacing(): void {
    for (const entry of this.selectedExamples) {
      if (this.taskSpacingMap[entry.example.id] == null) {
        this.taskSpacingMap[entry.example.id] = this.defaultTaskSpacing;
      }
    }
    this.spacingForAll = this.defaultTaskSpacing;
  }

  private attachPersistedSettingsToPayload(): void {
    this.test.defaultTaskSpacing = this.defaultTaskSpacing;
    this.test.taskSpacingMap = { ...this.taskSpacingMap };
    this.test.gradingMode = this.useAutomaticGrading ? 'auto' : 'manual';
    this.test.gradingSystemName = this.gradingSystemName;
    this.test.gradingSchema = this.gradingSchema.map((level, index) => ({
      ...level,
      order: index,
      percentageFrom: this.useAutomaticGrading ? Number(level.percentageFrom ?? 0) : 0,
      minimumPoints: this.useAutomaticGrading ? 0 : Number(level.minimumPoints ?? 0),
    }));
    this.test.gradePercentages = this.buildLegacyPercentageMap();
    this.test.manualGradeMinimums = this.buildLegacyMinimumMap();
  }

  private hydratePersistedSettings(response: any): void {
    const defaultSpacing = Number(
      response?.defaultTaskSpacing ??
      response?.layoutSettings?.defaultTaskSpacing ??
      this.defaultTaskSpacing
    );

    this.defaultTaskSpacing = this.normalizeSpacingValue(defaultSpacing);
    this.spacingForAll = this.defaultTaskSpacing;

    this.taskSpacingMap = this.normalizeNumberMap(
      response?.taskSpacingMap ??
      response?.layoutSettings?.taskSpacingMap ??
      {}
    );

    const gradingMode = response?.gradingMode ?? response?.gradingSettings?.mode ?? 'auto';
    this.useAutomaticGrading = gradingMode !== 'manual';

    const schema = Array.isArray(response?.gradingSchema) ? response.gradingSchema : [];
    this.gradingSystemName = response?.gradingSystemName ?? 'Österreich 1–5';

    if (schema.length) {
      this.gradingSchema = schema.map((level: any, index: number) => ({
        key: level?.key ?? `level-${index}`,
        label: level?.label ?? `Stufe ${index + 1}`,
        shortLabel: level?.shortLabel ?? String(index + 1),
        order: Number(level?.order ?? index),
        percentageFrom: Number(level?.percentageFrom ?? 0),
        minimumPoints: Number(level?.minimumPoints ?? 0),
      }));
    } else {
      const percentages = this.normalizeNumberMap(
        response?.gradePercentages ??
        response?.gradingSettings?.gradePercentages ??
        {}
      );

      const minimums = this.normalizeNumberMap(
        response?.manualGradeMinimums ??
        response?.gradingSettings?.manualGradeMinimums ??
        {}
      );

      this.gradingSchema = [
        { key: '1', label: 'Sehr gut', shortLabel: '1', order: 0, percentageFrom: percentages[1] ?? 90, minimumPoints: minimums[1] ?? 18 },
        { key: '2', label: 'Gut', shortLabel: '2', order: 1, percentageFrom: percentages[2] ?? 78, minimumPoints: minimums[2] ?? 16 },
        { key: '3', label: 'Befriedigend', shortLabel: '3', order: 2, percentageFrom: percentages[3] ?? 65, minimumPoints: minimums[3] ?? 13 },
        { key: '4', label: 'Genügend', shortLabel: '4', order: 3, percentageFrom: percentages[4] ?? 50, minimumPoints: minimums[4] ?? 10 },
        { key: '5', label: 'Nicht genügend', shortLabel: '5', order: 4, percentageFrom: 0, minimumPoints: 0 },
      ];
    }

    this.normalizeCurrentThresholds();
    this.attachPersistedSettingsToPayload();
  }

  private buildLegacyPercentageMap(): Record<number, number> {
    const map: Record<number, number> = {};
    this.gradingSchema.forEach((level, index) => {
      if (index < 4) {
        map[index + 1] = Number(level.percentageFrom ?? 0);
      }
    });
    return map;
  }

  private buildLegacyMinimumMap(): Record<number, number> {
    const map: Record<number, number> = {};
    this.gradingSchema.forEach((level, index) => {
      if (index < 4) {
        map[index + 1] = Number(level.minimumPoints ?? 0);
      }
    });
    return map;
  }

  private normalizeNumberMap(
    input: Record<number, number> | Record<string, number> | null | undefined
  ): Record<number, number> {
    const normalized: Record<number, number> = {};

    for (const [key, value] of Object.entries(input ?? {})) {
      const numericKey = Number(key);
      const numericValue = Number(value);

      if (Number.isFinite(numericKey) && Number.isFinite(numericValue)) {
        normalized[numericKey] = numericValue;
      }
    }

    return normalized;
  }

  private normalizeSpacingValue(value: number | string | null | undefined): number {
    const numeric = Math.round(Number(value ?? 0));
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(240, numeric));
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }

  private normalize(v: string): string {
    return (v ?? '').toString().trim().toLowerCase();
  }

  increaseCount(): void {
    this.printCopies = Math.min(20, (this.printCopies || 1) + 1);
  }

  decreaseCount(): void {
    this.printCopies = Math.max(1, (this.printCopies || 1) - 1);
  }

  openAddExampleDialog(): void {
    const ref = this.dialog.open(ExamplePickerDialogComponent, {
      width: 'min(94vw, 1220px)',
      maxWidth: '94vw',
      maxHeight: '92vh',
      autoFocus: false,
      panelClass: 'example-picker-dialog-panel',
      data: {
        examples: this.allExamples,
        selectedIds: this.selectedExamples.map(entry => entry.example.id),
        folders: this.exampleFolders,
      }
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result?: ExamplePickerDialogResult) => {
        if (!result?.selectedIds?.length) return;

        const examplesToAdd = this.allExamples.filter(example => result.selectedIds.includes(example.id));
        examplesToAdd.forEach(example => this.addExampleToSelection(example));
      });
  }
}
