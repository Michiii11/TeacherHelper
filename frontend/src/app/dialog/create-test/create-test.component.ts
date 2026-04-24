import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

import {MatFormField} from '@angular/material/input';
import { MatInput } from '@angular/material/input';
import { MatLabel } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Example, ExampleDTO, ExampleTypeLabels, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, GradingLevel, TestExample, TestExampleDTO, TestExampleVariableValues } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { TestBranding, TestPrintLabels, TestPrintService } from '../../service/test-print.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { ExamplePickerDialogComponent, ExamplePickerDialogResult } from '../example-picker-dialog/example-picker-dialog.component';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';

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
    MatButtonToggle,
    MatButtonToggleGroup,
    MatProgressBarModule,
    TranslateModule,
  ],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.scss',
})
export class CreateTestComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: string; testId?: string; folderId?: string | null }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateTestComponent>);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);
  private service = inject(HttpService);
  private testPrintService = inject(TestPrintService);
  private readonly destroy$ = new Subject<void>();
  private readonly exampleImageObjectUrls = new Set<string>();
  private readonly exampleImageObjectUrlCache = new Map<string, string>();

  showAdvancedSettings = false;
  printCopies = 1;
  includeSolutionSheet = false;
  readonly defaultImageWidth = 320;
  isExportingPdf = false;
  isExportingWord = false;
  isSaving = false;

  previewHtml: SafeHtml = '';
  labels: TestPrintLabels = this.buildPrintLabels();

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
    gradingSystemName: this.translate.instant('createTest.grading.presets.atName'),
    gradingSchema: [],
    gradePercentages: {},
    manualGradeMinimums: {}
  };

  hasUnsavedChanges = false;
  isEditMode = false;

  defaultTaskSpacing = 48;
  spacingForAll = 48;
  taskSpacingMap: Record<string, number> = {};

  useAutomaticGrading = true;
  gradingSystemName = this.translate.instant('createTest.grading.presets.atName');
  gradingSchema: GradingLevel[] = [];

  readonly gradingPresets: Record<GradePresetKey, { name: string; levels: Omit<GradingLevel, 'order'>[] }> = {
    AT: {
      name: this.translate.instant('createTest.grading.presets.atName'),
      levels: [
        { key: '1', label: this.translate.instant('createTest.grading.labels.veryGood'), shortLabel: '1', percentageFrom: 90, minimumPoints: 18 },
        { key: '2', label: this.translate.instant('createTest.grading.labels.good'), shortLabel: '2', percentageFrom: 78, minimumPoints: 16 },
        { key: '3', label: this.translate.instant('createTest.grading.labels.satisfactory'), shortLabel: '3', percentageFrom: 65, minimumPoints: 13 },
        { key: '4', label: this.translate.instant('createTest.grading.labels.passing'), shortLabel: '4', percentageFrom: 50, minimumPoints: 10 },
        { key: '5', label: this.translate.instant('createTest.grading.labels.failed'), shortLabel: '5', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    DE: {
      name: this.translate.instant('createTest.grading.presets.deName'),
      levels: [
        { key: '1', label: this.translate.instant('createTest.grading.labels.veryGood'), shortLabel: '1', percentageFrom: 92, minimumPoints: 18 },
        { key: '2', label: this.translate.instant('createTest.grading.labels.good'), shortLabel: '2', percentageFrom: 81, minimumPoints: 16 },
        { key: '3', label: this.translate.instant('createTest.grading.labels.satisfactory'), shortLabel: '3', percentageFrom: 67, minimumPoints: 13 },
        { key: '4', label: this.translate.instant('createTest.grading.labels.sufficient'), shortLabel: '4', percentageFrom: 50, minimumPoints: 10 },
        { key: '5', label: this.translate.instant('createTest.grading.labels.poor'), shortLabel: '5', percentageFrom: 30, minimumPoints: 6 },
        { key: '6', label: this.translate.instant('createTest.grading.labels.insufficient'), shortLabel: '6', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    US: {
      name: this.translate.instant('createTest.grading.presets.usName'),
      levels: [
        { key: 'A', label: this.translate.instant('createTest.grading.labels.excellent'), shortLabel: 'A', percentageFrom: 90, minimumPoints: 18 },
        { key: 'B', label: this.translate.instant('createTest.grading.labels.goodEn'), shortLabel: 'B', percentageFrom: 80, minimumPoints: 16 },
        { key: 'C', label: this.translate.instant('createTest.grading.labels.satisfactoryEn'), shortLabel: 'C', percentageFrom: 70, minimumPoints: 14 },
        { key: 'D', label: this.translate.instant('createTest.grading.labels.passingEn'), shortLabel: 'D', percentageFrom: 60, minimumPoints: 12 },
        { key: 'F', label: this.translate.instant('createTest.grading.labels.fail'), shortLabel: 'F', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    MITARBEIT: {
      name: this.translate.instant('createTest.grading.presets.participationName'),
      levels: [
        { key: 'plusplus', label: this.translate.instant('createTest.grading.labels.veryActive'), shortLabel: '++', percentageFrom: 90, minimumPoints: 18 },
        { key: 'plus', label: this.translate.instant('createTest.grading.labels.active'), shortLabel: '+', percentageFrom: 75, minimumPoints: 15 },
        { key: 'neutral', label: this.translate.instant('createTest.grading.labels.ok'), shortLabel: 'o', percentageFrom: 55, minimumPoints: 11 },
        { key: 'minus', label: this.translate.instant('createTest.grading.labels.lowParticipation'), shortLabel: '-', percentageFrom: 30, minimumPoints: 6 },
        { key: 'minusminus', label: this.translate.instant('createTest.grading.labels.noParticipation'), shortLabel: '--', percentageFrom: 0, minimumPoints: 0 },
      ]
    },
    CUSTOM: {
      name: this.translate.instant('createTest.grading.presets.customName'),
      levels: [
        { key: 'top', label: this.translate.instant('createTest.grading.labels.top'), shortLabel: 'Top', percentageFrom: 90, minimumPoints: 18 },
        { key: 'mid', label: this.translate.instant('createTest.grading.labels.mid'), shortLabel: 'Mid', percentageFrom: 60, minimumPoints: 12 },
        { key: 'low', label: this.translate.instant('createTest.grading.labels.low'), shortLabel: 'Low', percentageFrom: 0, minimumPoints: 0 },
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
          next: async (response: any) => {
            this.test = {
              ...this.test,
              ...response,
            };
            this.isEditMode = true;
            const hydratedEntries = (await this.hydrateConstructionImagesForEntries(this.test.exampleList ?? [])).map(entry => ({
              ...entry,
              variableValues: {
                ...this.buildDefaultVariableValues(entry.example),
                ...(entry.variableValues ?? {})
              }
            }));
            this.selectedExamplesInternal = hydratedEntries;
            this.test.exampleList = hydratedEntries;
            this.hydratePersistedSettings(response);
            this.initializeTaskSpacing();
            this.refreshPreviewHtml();
            this.hasUnsavedChanges = false;
          },
        });
    }

    this.service.getFullExamples(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (examples) => {
        this.allExamples = await this.hydrateConstructionImagesForExamples(examples);
        this.refreshPreviewHtml();
      });

    this.service.getFolders(String(this.data.schoolId))
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

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.labels = this.buildPrintLabels();
        this.refreshPreviewHtml();
      });

    this.loadSchoolBranding();
    this.refreshPreviewHtml();
  }


  private loadSchoolBranding(): void {
    const serviceAny = this.service as any;
    const request = serviceAny?.getSchool?.(this.data.schoolId) ?? serviceAny?.getSchoolById?.(this.data.schoolId);

    if (!request?.subscribe) {
      this.refreshPreviewHtml();
      return;
    }

    request
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (school: any) => {
          if (!school) {
            this.refreshPreviewHtml();
            return;
          }

          (this.test as any).schoolName = (this.test as any).schoolName || school?.name || '';
          (this.test as any).schoolLogoUrl = (this.test as any).schoolLogoUrl || (this.service as any)?.getSchoolLogo?.(school, this.data.schoolId) || school?.logoUrl || school?.logo || '';
          (this.test as any).school = {
            ...(this.test as any).school,
            ...school,
          };
          this.refreshPreviewHtml();
        },
        error: () => {
          this.refreshPreviewHtml();
        }
      });
  }

  ngOnDestroy(): void {
    this.exampleImageObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.exampleImageObjectUrls.clear();
    this.exampleImageObjectUrlCache.clear();
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

  async addExampleToSelection(example: Example | ExampleDTO): Promise<void> {
    const current = this.selectedExamplesInternal;
    if (current.some((x) => x.example?.id === example.id)) return;

    const hydratedExample = await this.hydrateConstructionImage(example);

    const newEntry: TestExample = {
      id: example.id,
      example: hydratedExample,
      points: 0,
      title: '',
      variableValues: this.buildDefaultVariableValues(hydratedExample),
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

  moveSelectedExample(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.selectedExamplesInternal.length) {
      return;
    }

    const next = [...this.selectedExamplesInternal];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;

    this.selectedExamplesInternal = next;
    this.syncSelectionToTest(next);
    this.markDirty();
  }

  trackBySelectedExample = (_: number, entry: TestExampleDTO): string => entry.example.id;

  trackByGradingLevel = (_: number, level: GradingLevel): string =>
    String(level.key ?? level.order ?? _);

  get selectedExamples(): TestExampleDTO[] {
    return this.selectedExamplesInternal;
  }

  get totalPoints(): number {
    const total = this.selectedExamples.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
    return this.roundToStep(total, 1);
  }



  get gradingModeSelection(): GradeMode {
    return this.useAutomaticGrading ? 'auto' : 'manual';
  }
  get gradeHeaderLabel(): string {
    const name = this.normalize(this.gradingSystemName);
    if (name.includes('usa') || name.includes('a–f') || name.includes('a-f')) return 'Grade';
    if (name.includes('mitarbeit') || name.includes('feedback')) return 'Bewertung';
    return 'Note';
  }

  get gradeTableHeading(): string {
    return this.useAutomaticGrading
      ? this.translate.instant('createTest.grading.fromPercent')
      : this.translate.instant('createTest.grading.fromPoints');
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

  getExampleVariables(entry: TestExampleDTO) {
    return entry.example.variables ?? [];
  }

  hasVariables(entry: TestExampleDTO): boolean {
    return this.getExampleVariables(entry).length > 0;
  }

  trackByVariableValue(index: number, variable: { key: string }): string {
    return variable.key || String(index);
  }

  getVariableValue(entry: TestExampleDTO, key: string): string {
    return entry.variableValues?.[key] ?? this.getDefaultVariableValue(entry, key);
  }

  onVariableValueChange(entry: TestExampleDTO, key: string, value: string | null): void {
    entry.variableValues = {
      ...(entry.variableValues ?? {}),
      [key]: value ?? '',
    };
    this.markDirty();
  }

  private buildDefaultVariableValues(example: Example | ExampleDTO): TestExampleVariableValues {
    return Object.fromEntries(
      (example.variables ?? []).map(variable => [variable.key, variable.defaultValue ?? ''])
    );
  }

  private getDefaultVariableValue(entry: TestExampleDTO, key: string): string {
    return entry.example.variables?.find(variable => variable.key === key)?.defaultValue ?? '';
  }

  private resolveVariables(value: string | null | undefined, variableValues?: TestExampleVariableValues, example?: Example | ExampleDTO): string {
    return (value ?? '').replace(/\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g, (_match, key: string) => {
      if (variableValues && key in variableValues) {
        return variableValues[key] ?? '';
      }
      return example?.variables?.find(variable => variable.key === key)?.defaultValue ?? '';
    });
  }

  getResolvedEntryTitle(entry: TestExampleDTO): string {
    const fallback = this.getExampleHeading(entry.example);
    return this.resolveVariables(entry.title?.trim() || fallback, entry.variableValues, entry.example);
  }

  getResolvedExampleHeading(example: Example | ExampleDTO, variableValues?: TestExampleVariableValues): string {
    const fallback = example.instruction?.trim() || example.question?.trim() || `Beispiel #${example.id}`;
    return this.resolveVariables(fallback, variableValues, example);
  }


  getExampleTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    return ExampleTypeLabels[type as ExampleTypes] ?? String(type);
  }

  getFolderPathLabel(folderId: string | null): string {
    if (folderId === null) return this.translate.instant('school.root');

    const crumbs: string[] = [];
    let current = this.exampleFolders.find(folder => folder.id === folderId) ?? null;

    while (current) {
      crumbs.unshift(current.name);
      current = this.exampleFolders.find(folder => folder.id === current?.parentId) ?? null;
    }

    const rootLabel = this.translate.instant('school.root');
    return crumbs.length ? [rootLabel, ...crumbs].join(' / ') : rootLabel;
  }

  saveTest(): void {
    this.test.authToken = localStorage.getItem('teacher_authToken') || '';
    this.test.schoolId = this.test.schoolId || this.data.schoolId;
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
            this.isEditMode ? this.translate.instant('createTest.snackbar.updated') : this.translate.instant('createTest.snackbar.created'),
            'OK',
            { duration: 3000 }
          );
          this.hasUnsavedChanges = false;
          this.dialogRef.close(this.test);

          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
          this.snackBar.open(this.translate.instant('createTest.snackbar.saveError'), 'OK', { duration: 3000 });
        }
      });
  }

  async exportPdf(): Promise<void> {
    if (!this.selectedExamples.length) {
      this.snackBar.open(this.translate.instant('createTest.snackbar.selectExampleFirst'), 'OK', { duration: 2500 });
      return;
    }

    this.attachPersistedSettingsToPayload();
    this.isExportingPdf = true;

    const success = await this.testPrintService.exportPdf(this.test, this.buildResolvedExamplesForPreview(), {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
      labels: this.labels,
      branding: this.resolveBranding(),
    });

    this.isExportingPdf = false;

    this.snackBar.open(
      success ? this.translate.instant('createTest.snackbar.pdfDownloaded') : this.translate.instant('createTest.snackbar.pdfError'),
      'OK',
      { duration: 3000 }
    );
  }

  async exportWord(): Promise<void> {
    if (!this.selectedExamples.length) {
      this.snackBar.open(this.translate.instant('createTest.snackbar.selectExampleFirst'), 'OK', { duration: 2500 });
      return;
    }

    this.attachPersistedSettingsToPayload();
    this.isExportingWord = true;

    const success = await this.testPrintService.exportWord(this.test, this.buildResolvedExamplesForPreview(), {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
      labels: this.labels,
      branding: this.resolveBranding(),
    });

    this.isExportingWord = false;

    this.snackBar.open(
      success ? this.translate.instant('createTest.snackbar.wordDownloaded') : this.translate.instant('createTest.snackbar.wordError'),
      'OK',
      { duration: 3000 }
    );
  }

  async closeDialog(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: this.translate.instant('createTest.closeWarning.title'),
          message: this.translate.instant('createTest.closeWarning.message'),
          cancelText: this.translate.instant('common.cancel'),
          confirmText: this.translate.instant('createTest.closeWarning.confirm'),
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
    this.refreshPreviewHtml();
  }

  onPointsChanged(): void {
    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }
    this.markDirty();
  }

  onPointsInput(entry: TestExampleDTO, value: number | string | null): void {
    entry.points = this.normalizeDecimalValue(value, 1);
    this.markDirty();
  }

  onPointsBlur(entry: TestExampleDTO): void {
    entry.points = this.normalizeDecimalValue(entry.points, 1);
    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }
    this.markDirty();
  }

  onAutomaticThresholdInput(level: GradingLevel, value: number | string | null): void {
    level.percentageFrom = this.normalizeDecimalValue(value, 1);
    this.markDirty();
  }

  onManualThresholdInput(level: GradingLevel, value: number | string | null): void {
    level.minimumPoints = this.normalizeDecimalValue(value, 1);
    this.markDirty();
  }

  onLevelBlur(): void {
    this.normalizeCurrentThresholds();
    this.markDirty();
  }

  onTaskSpacingChange(exampleId: string, value: number | string | null): void {
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

  getTaskSpacing(exampleId: string): number {
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
    const switchingToManual = mode === 'manual' && this.useAutomaticGrading;

    this.useAutomaticGrading = mode === 'auto';

    if (this.useAutomaticGrading) {
      this.normalizeAutomaticThresholds();
    } else {
      if (switchingToManual) {
        this.syncManualThresholdsFromPercentages();
      }
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
    this.syncManualThresholdsFromPercentages();
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

    this.gradingSystemName = this.gradingSystemName || this.translate.instant('createTest.grading.customSchema');
    this.gradingSchema = [
      ...this.gradingSchema,
      {
        key: `level-${Date.now()}-${nextIndex}`,
        label: `${this.translate.instant('createTest.grading.level')} ${nextIndex + 1}`,
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
      this.snackBar.open(this.translate.instant('createTest.snackbar.minimumTwoLevels'), 'OK', { duration: 2500 });
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
    this.gradingSystemName = value?.trim() || this.translate.instant('createTest.grading.customSchema');
    this.markDirty();
  }

  onLevelChanged(): void {
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

    this.gradingSchema.forEach((level, index) => {
      const raw = Number(level.percentageFrom ?? (index === this.gradingSchema.length - 1 ? 0 : last));
      const normalized = index === this.gradingSchema.length - 1
        ? 0
        : Math.max(0, Math.min(last, this.roundToStep(raw, 1)));

      last = normalized;
      level.order = index;
      level.percentageFrom = normalized;
    });

    if (this.gradingSchema.length) {
      this.gradingSchema[this.gradingSchema.length - 1].percentageFrom = 0;
    }
  }

  normalizeManualThresholds(): void {
    const total = this.totalPoints;
    let last = total;

    this.gradingSchema.forEach((level, index) => {
      const raw = Number(level.minimumPoints ?? (index === this.gradingSchema.length - 1 ? 0 : last));
      const normalized = index === this.gradingSchema.length - 1
        ? 0
        : Math.max(0, Math.min(last, this.roundToStep(raw, 1)));

      last = normalized;
      level.order = index;
      level.minimumPoints = normalized;
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
      const value = Math.ceil(this.totalPoints * (percentage / 100));
      return Math.max(0, Math.min(this.totalPoints, value));
    }

    return Math.max(
      0,
      Math.min(
        this.totalPoints,
        this.roundToStep(Number(this.gradingSchema[index].minimumPoints ?? 0), 1)
      )
    );
  }

  private isWholeNumber(value: number): boolean {
    return Math.abs(value - Math.round(value)) < 0.0001;
  }

  getGradeRangeLabelByIndex(index: number): string {
    const total = this.totalPoints;
    if (total <= 0) return '–';
    if (!this.gradingSchema[index]) return '–';

    const min = this.getGradeMinimumByIndex(index);

    if (this.useAutomaticGrading) {
      const upper = index === 0
        ? Math.round(total)
        : this.getGradeMinimumByIndex(index - 1) - 1;

      if (upper < min) return String(min);
      if (upper === min) return String(min);
      return `${upper}-${min}`;
    }

    const previousMin = index === 0 ? total : this.getGradeMinimumByIndex(index - 1);
    const shouldUseWholeNumbers = this.isWholeNumber(min) && this.isWholeNumber(previousMin);

    const upper = index === 0
      ? total
      : shouldUseWholeNumbers
        ? previousMin - 1
        : this.roundToStep(previousMin - 0.1, 1);

    if (upper < min) return this.formatScore(min);
    if (upper === min) return this.formatScore(min);

    return `${this.formatScore(upper)}-${this.formatScore(min)}`;
  }

  getPreviewImage(example: Example | ExampleDTO): string | null {
    return (example as any).imageUrl || (example as any).image || null;
  }

  getImageWidth(example: Example | ExampleDTO): number {
    return this.normalizeImageWidth((example as any).imageWidth);
  }

  getQuestionWithGapLabels(example: Example | ExampleDTO): string {
    let idx = 0;
    return this.resolveVariables(example.question, undefined, example).replace(/\{Lücke \d+\}/g, () => {
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
    this.testPrintService.printTest(this.test, this.buildResolvedExamplesForPreview(), {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
      labels: this.labels,
      branding: this.resolveBranding(),
    });
  }


  private translateOrFallback(key: string, fallback: string): string {
    const value = this.translate.instant(key);
    return value && value !== key ? value : fallback;
  }

  private buildPrintLabels(): TestPrintLabels {
    return {
      name: this.translateOrFallback('createTest.preview.name', 'Name'),
      class: this.translateOrFallback('createTest.preview.class', 'Class'),
      date: this.translateOrFallback('createTest.preview.date', 'Date'),
      achievedPoints: this.translateOrFallback('createTest.preview.achievedPoints', 'Achieved points'),
      gradeHeader: this.gradeHeaderLabel || this.translateOrFallback('createTest.preview.gradeHeader', 'Grade'),
      gradingKey: this.translateOrFallback('createTest.preview.gradingKey', 'Grading key'),
      points: this.translateOrFallback('createTest.grading.points', 'Points'),
      exampleShort: this.translateOrFallback('createTest.preview.exampleShort', 'Ex.'),
      goodLuck: this.translateOrFallback('createTest.preview.goodLuck', 'Good luck!'),
      untitled: this.translateOrFallback('createTest.untitled', 'Untitled test'),
      solutionSuffix: this.translateOrFallback('createTest.print.solutionSuffix', '– Solution'),
      solutionNote: this.translateOrFallback('createTest.print.solutionNote', 'These pages contain the sample solutions.'),
      noSolution: this.translateOrFallback('createTest.print.noSolution', 'No solution stored.'),
      gap: this.translateOrFallback('exampleDialog.gap', 'Gap'),
      imagePreviewAlt: this.translateOrFallback('createTest.preview.imagePreviewAlt', 'Preview image'),
      previewTitle: this.translateOrFallback('createTest.preview.title', 'Test preview'),
      previewSubtitle: this.translateOrFallback('createTest.preview.subtitle', 'Preview and print layout'),
      question: this.translateOrFallback('school.question', 'Question'),
    };
  }

  private resolveBranding(): TestBranding {
    const school = (this.test as any)?.school ?? null;
    const dialogData = this.data as any;
    const schoolId = Number((this.test as any)?.schoolId || dialogData?.schoolId || this.data.schoolId);
    const logoFromService = (this.service as any)?.getSchoolLogo?.(school, schoolId);

    return {
      schoolName: (this.test as any)?.schoolName || school?.name || dialogData?.schoolName || '',
      schoolLogoUrl: logoFromService || (this.test as any)?.schoolLogoUrl || school?.logoUrl || school?.logo || dialogData?.schoolLogoUrl || dialogData?.schoolLogo || '',
      showNameWhenLogoExists: true,
    };
  }

  private isDarkModeActive(): boolean {
    return document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
  }

  private resolveOptionList(options: any[] | null | undefined, variableValues?: TestExampleVariableValues, example?: Example | ExampleDTO): any[] {
    return (options ?? []).map(option => ({
      ...option,
      text: this.resolveVariables(option?.text, variableValues, example),
    }));
  }

  private resolveGapList(gaps: any[] | null | undefined, variableValues?: TestExampleVariableValues, example?: Example | ExampleDTO): any[] {
    return (gaps ?? []).map(gap => ({
      ...gap,
      label: this.resolveVariables(gap?.label, variableValues, example),
      solution: this.resolveVariables(gap?.solution, variableValues, example),
      options: this.resolveOptionList(gap?.options, variableValues, example),
    }));
  }

  private resolveAssignList(assigns: any[] | null | undefined, variableValues?: TestExampleVariableValues, example?: Example | ExampleDTO): any[] {
    return (assigns ?? []).map(assign => ({
      ...assign,
      left: this.resolveVariables(assign?.left, variableValues, example),
      right: this.resolveVariables(assign?.right, variableValues, example),
    }));
  }

  private buildResolvedExamplesForPreview(): TestExampleDTO[] {
    return this.selectedExamples.map(entry => ({
      ...entry,
      title: this.getResolvedEntryTitle(entry),
      example: {
        ...entry.example,
        instruction: this.resolveVariables(entry.example.instruction, entry.variableValues, entry.example),
        question: this.resolveVariables(entry.example.question, entry.variableValues, entry.example),
        solution: this.resolveVariables((entry.example as any).solution, entry.variableValues, entry.example),
        answers: (entry.example.answers ?? []).map(answer => [
          this.resolveVariables(answer?.[0], entry.variableValues, entry.example),
          this.resolveVariables(answer?.[1], entry.variableValues, entry.example),
        ]),
        options: this.resolveOptionList(entry.example.options, entry.variableValues, entry.example),
        gaps: this.resolveGapList(entry.example.gaps, entry.variableValues, entry.example),
        assigns: this.resolveAssignList(entry.example.assigns, entry.variableValues, entry.example),
        assignRightItems: (entry.example.assignRightItems ?? []).map(item => this.resolveVariables(item, entry.variableValues, entry.example)),
      } as Example
    }));
  }

  private refreshPreviewHtml(): void {
    this.attachPersistedSettingsToPayload();
    this.labels = this.buildPrintLabels();

    const html = this.testPrintService.buildPreviewHtml(this.test, this.buildResolvedExamplesForPreview(), {
      printCopies: 1,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
      labels: this.labels,
      branding: this.resolveBranding(),
    });

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private async hydrateConstructionImagesForExamples(examples: ExampleDTO[]): Promise<ExampleDTO[]> {
    return Promise.all((examples ?? []).map(async example =>
      await this.hydrateConstructionImage(example) as unknown as ExampleDTO
    ));
  }

  private async hydrateConstructionImagesForEntries(entries: TestExampleDTO[]): Promise<TestExampleDTO[]> {
    return Promise.all((entries ?? []).map(async entry => ({
      ...entry,
      example: await this.hydrateConstructionImage(entry.example)
    })));
  }

  private async hydrateConstructionImage(example: Example | ExampleDTO): Promise<Example> {
    if (!example || example.type !== ExampleTypes.CONSTRUCTION || !example.id) {
      return <Example>example;
    }

    const normalizedExample = this.toExample(example);
    const hasTaskImage = !!((normalizedExample as any).imageUrl || (normalizedExample as any).image);
    const hasSolutionImage = !!((normalizedExample as any).solutionUrl);
    const taskImageUrl = hasTaskImage
      ? await this.getAuthorizedExampleImageObjectUrl(normalizedExample.id, false)
      : '';
    const solutionImageUrl = hasSolutionImage
      ? await this.getAuthorizedExampleImageObjectUrl(normalizedExample.id, true)
      : '';

    return {
      ...normalizedExample,
      imageUrl: taskImageUrl,
      image: taskImageUrl,
      solutionUrl: solutionImageUrl,
    } as Example & { image?: string };
  }

  private async getAuthorizedExampleImageObjectUrl(exampleId: string, isSolution: boolean): Promise<string> {
    const cacheKey = `${exampleId}:${isSolution ? 'solution' : 'task'}`;
    const cached = this.exampleImageObjectUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = await this.service.getExampleImageObjectUrl(exampleId, isSolution);
      if (url) {
        this.exampleImageObjectUrlCache.set(cacheKey, url);
        this.exampleImageObjectUrls.add(url);
      }
      return url || '';
    } catch {
      return '';
    }
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
    this.gradingSystemName = response?.gradingSystemName ?? this.translate.instant('createTest.grading.presets.atName');

    if (schema.length) {
      this.gradingSchema = schema.map((level: any, index: number) => ({
        key: level?.key ?? `level-${index}`,
        label: level?.label ?? `${this.translate.instant('createTest.grading.level')} ${index + 1}`,
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
        { key: '1', label: this.translate.instant('createTest.grading.labels.veryGood'), shortLabel: '1', order: 0, percentageFrom: percentages[1] ?? 90, minimumPoints: minimums[1] ?? 18 },
        { key: '2', label: this.translate.instant('createTest.grading.labels.good'), shortLabel: '2', order: 1, percentageFrom: percentages[2] ?? 78, minimumPoints: minimums[2] ?? 16 },
        { key: '3', label: this.translate.instant('createTest.grading.labels.satisfactory'), shortLabel: '3', order: 2, percentageFrom: percentages[3] ?? 65, minimumPoints: minimums[3] ?? 13 },
        { key: '4', label: this.translate.instant('createTest.grading.labels.passing'), shortLabel: '4', order: 3, percentageFrom: percentages[4] ?? 50, minimumPoints: minimums[4] ?? 10 },
        { key: '5', label: this.translate.instant('createTest.grading.labels.failed'), shortLabel: '5', order: 4, percentageFrom: 0, minimumPoints: 0 },
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

  private normalizeDecimalValue(value: number | string | null | undefined, decimals = 1): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;

    const factor = Math.pow(10, decimals);
    return Math.round(numeric * factor) / factor;
  }

  private roundToStep(value: number, decimals = 1): number {
    const factor = Math.pow(10, decimals);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  private formatScore(value: number): string {
    const rounded = this.roundToStep(value, 1);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
      .subscribe(async (result?: ExamplePickerDialogResult) => {
        if (!result?.selectedIds?.length) return;

        const examplesToAdd = this.allExamples.filter(example => result.selectedIds.includes(example.id));
        for (const example of examplesToAdd) {
          await this.addExampleToSelection(example);
        }
      });
  }

  private syncManualThresholdsFromPercentages(): void {
    const total = this.totalPoints;

    this.gradingSchema = this.gradingSchema.map((level, index) => {
      const percentage = Number(level.percentageFrom ?? 0);

      const derivedMinimum =
        index === this.gradingSchema.length - 1
          ? 0
          : Math.max(0, Math.min(total, Math.ceil(total * (percentage / 100))));

      return {
        ...level,
        minimumPoints: derivedMinimum,
        order: index,
      };
    });
  }
}
