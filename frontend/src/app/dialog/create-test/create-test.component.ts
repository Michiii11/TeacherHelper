import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

import { MatFormField } from '@angular/material/input';
import { MatInput } from '@angular/material/input';
import { MatLabel } from '@angular/material/input';

import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { map, startWith, takeUntil } from 'rxjs/operators';

import { Example, ExampleDTO, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, TestExample, TestExampleDTO } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { TestPrintService } from '../../service/test-print.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatPseudoCheckbox } from '@angular/material/core';

type GradeMode = 'auto' | 'manual';

type PersistedTestSettings = {
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number> | Record<string, number>;
  gradingMode?: GradeMode;
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
    MatButton,
    MatDialogActions,
    MatDialogContent,
    CdkTextareaAutosize,
    MatFormField,
    MatInput,
    MatLabel,
    MatAutocompleteModule,
    MatIconModule,
    MatDividerModule,
    MatIconButton,
    MatPseudoCheckbox,
  ],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.scss',
})
export class CreateTestComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: number; testId: number }>(MAT_DIALOG_DATA);
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
    gradePercentages: {
      1: 90,
      2: 78,
      3: 65,
      4: 50,
    },
    manualGradeMinimums: {
      1: 18,
      2: 16,
      3: 13,
      4: 10,
    }
  };

  hasUnsavedChanges = false;
  isEditMode = false;

  private allExamplesSubject = new BehaviorSubject<ExampleDTO[]>([]);
  private selectedExamplesSubject = new BehaviorSubject<TestExampleDTO[]>([]);

  exampleCtrl = new FormControl<string | Example>('');

  filteredExamples$: Observable<ExampleDTO[]> = combineLatest([
    this.allExamplesSubject.asObservable(),
    this.selectedExamplesSubject.asObservable(),
    this.exampleCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([all, selected, raw]) => {
      const selectedIds = new Set(selected.map((s) => s.example.id));
      const query = this.normalize(typeof raw === 'string' ? raw : this.displayExample(raw));
      const available = all.filter((e) => !selectedIds.has(e.id));
      if (!query) return available;
      return available.filter((e) => this.matchesQuery(e, query));
    })
  );

  defaultTaskSpacing = 48;
  spacingForAll = 48;
  taskSpacingMap: Record<number, number> = {};

  useAutomaticGrading = true;
  gradePercentages: Record<number, number> = {
    1: 90,
    2: 78,
    3: 65,
    4: 50,
  };
  manualGradeMinimums: Record<number, number> = {
    1: 18,
    2: 16,
    3: 13,
    4: 10,
  };

  readonly defaultGradePercentages: Record<number, number> = {
    1: 90,
    2: 78,
    3: 65,
    4: 50,
  };

  readonly gradeLabels: Record<number, string> = {
    1: 'Sehr gut',
    2: 'Gut',
    3: 'Befriedigend',
    4: 'Genügend',
    5: 'Nicht genügend',
  };

  protected readonly ExampleTypes = ExampleTypes;

  constructor() {
    this.dialogRef.disableClose = true;

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
            this.selectedExamplesSubject.next(hydratedEntries);
            this.test.exampleList = hydratedEntries;
            this.hydratePersistedSettings(response);
            this.initializeTaskSpacing();

            if (this.useAutomaticGrading) {
              this.syncManualGradeMinimumsWithAuto();
            }

            this.hasUnsavedChanges = false;
          },
        });
    }

    this.service.getFullExamples(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((examples) => {
        this.allExamplesSubject.next(this.hydrateConstructionImagesForExamples(examples as ExampleDTO[]));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayExample = (value: Example | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.question?.trim() ?? '';
  };

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

  onExampleSelected(event: MatAutocompleteSelectedEvent): void {
    const picked = event.option.value as Example;
    this.addExampleToSelection(picked);
    this.exampleCtrl.setValue('');
  }

  addExampleToSelection(example: Example): void {
    const current = this.selectedExamplesSubject.value;
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
    this.selectedExamplesSubject.next(next);
    this.syncSelectionToTest(next);
    this.taskSpacingMap[example.id] = this.defaultTaskSpacing;

    if (this.useAutomaticGrading) {
      this.syncManualGradeMinimumsWithAuto();
    }

    this.markDirty();
  }

  removeSelectedExample(entry: TestExampleDTO): void {
    const next = this.selectedExamplesSubject.value.filter((x) => x.example.id !== entry.example.id);
    this.selectedExamplesSubject.next(next);
    this.syncSelectionToTest(next);
    delete this.taskSpacingMap[entry.example.id];

    if (this.useAutomaticGrading) {
      this.syncManualGradeMinimumsWithAuto();
    }

    this.markDirty();
  }

  get selectedExamples(): TestExampleDTO[] {
    return this.selectedExamplesSubject.value;
  }

  get totalPoints(): number {
    return this.selectedExamples.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
  }

  protected saveTest(): void {
    this.test.authToken = localStorage.getItem('teacher_authToken') || '';
    this.test.schoolId = Number(this.test.schoolId || this.data.schoolId);
    this.test.exampleList = this.selectedExamplesSubject.value;

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
      getGradeRangeLabel: (grade) => this.getGradeRangeLabel(grade),
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
      getGradeRangeLabel: (grade) => this.getGradeRangeLabel(grade),
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
    if (this.useAutomaticGrading) {
      this.syncManualGradeMinimumsWithAuto();
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
      this.syncManualGradeMinimumsWithAuto();
    }

    this.markDirty();
  }

  resetGrading(): void {
    this.gradePercentages = { ...this.defaultGradePercentages };

    if (this.useAutomaticGrading) {
      this.syncManualGradeMinimumsWithAuto();
    } else {
      this.manualGradeMinimums = {
        1: this.getAutomaticGradeMinimum(1),
        2: this.getAutomaticGradeMinimum(2),
        3: this.getAutomaticGradeMinimum(3),
        4: this.getAutomaticGradeMinimum(4),
      };
    }

    this.markDirty();
  }

  normalizePercentages(): void {
    let last = 100;

    for (const grade of [1, 2, 3, 4]) {
      const raw = Number(this.gradePercentages[grade] ?? 0);
      const normalized = Math.max(0, Math.min(last, Math.round(raw)));
      this.gradePercentages[grade] = normalized;
      last = normalized;
    }

    if (this.useAutomaticGrading) {
      this.syncManualGradeMinimumsWithAuto();
    }

    this.markDirty();
  }

  normalizeManualGradeMinimums(): void {
    const total = this.totalPoints;
    let last = total;

    for (const grade of [1, 2, 3, 4]) {
      const raw = Number(this.manualGradeMinimums[grade] ?? 0);
      const normalized = Math.max(0, Math.min(last, Math.round(raw)));
      this.manualGradeMinimums[grade] = normalized;
      last = normalized;
    }

    this.markDirty();
  }

  getGradePercentage(grade: number): number {
    return Number(this.gradePercentages[grade] ?? 0);
  }

  getGradeMinimum(grade: number): number {
    if (grade === 5) return 0;

    if (this.useAutomaticGrading) {
      return this.getAutomaticGradeMinimum(grade);
    }

    return Math.max(0, Math.min(this.totalPoints, Math.round(Number(this.manualGradeMinimums[grade] ?? 0))));
  }

  getGradeRangeLabel(grade: number): string {
    const total = this.totalPoints;
    if (total <= 0) return '–';

    const min = this.getGradeMinimum(grade);
    const upper = grade === 1 ? total : this.getGradeMinimum(grade - 1) - 1;

    if (upper < min) return `${min}`;
    if (min === upper) return `${upper}`;
    return `${upper}-${min}`;
  }

  getAutomaticGradeMinimum(grade: number): number {
    const total = this.totalPoints;
    if (grade === 5) return 0;

    const percentage = Number(this.gradePercentages[grade] ?? 0);
    return Math.max(0, Math.min(total, Math.ceil(total * (percentage / 100))));
  }

  syncManualGradeMinimumsWithAuto(): void {
    this.manualGradeMinimums = {
      1: this.getAutomaticGradeMinimum(1),
      2: this.getAutomaticGradeMinimum(2),
      3: this.getAutomaticGradeMinimum(3),
      4: this.getAutomaticGradeMinimum(4),
    };

    this.attachPersistedSettingsToPayload();
  }

  getPreviewImage(example: Example): string | null {
    return (example as any).imageUrl || (example as any).image || null;
  }

  getImageWidth(example: Example): number {
    return this.normalizeImageWidth((example as any).imageWidth);
  }

  getQuestionWithGapLabels(example: Example): string {
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
      getGradeRangeLabel: (grade) => this.getGradeRangeLabel(grade),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
    });
  }

  private hydrateConstructionImagesForExamples(examples: ExampleDTO[]): ExampleDTO[] {
    return (examples ?? []).map(example => this.hydrateConstructionImage(example as unknown as Example) as unknown as ExampleDTO);
  }

  private hydrateConstructionImagesForEntries(entries: TestExampleDTO[]): TestExampleDTO[] {
    return (entries ?? []).map(entry => ({
      ...entry,
      example: this.hydrateConstructionImage(entry.example)
    }));
  }

  private hydrateConstructionImage(example: Example): Example {
    if (!example || example.type !== ExampleTypes.CONSTRUCTION || !example.id) {
      return example;
    }

    const hasTaskImage = !!((example as any).imageUrl || (example as any).image);
    const hasSolutionImage = !!((example as any).solutionUrl);

    return {
      ...example,
      imageUrl: hasTaskImage ? (this.service.getConstructionImageUrl(example.id) ?? '') : '',
      image: hasTaskImage ? (this.service.getConstructionImageUrl(example.id) ?? '') : '',
      solutionUrl: hasSolutionImage ? (this.service.getConstructionSolutionImageUrl(example.id) ?? '') : ''
    } as Example & { image?: string };
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
    this.test.gradePercentages = { ...this.gradePercentages };
    this.test.manualGradeMinimums = { ...this.manualGradeMinimums };
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

    const percentages = this.normalizeNumberMap(
      response?.gradePercentages ??
      response?.gradingSettings?.gradePercentages ??
      this.defaultGradePercentages
    );

    this.gradePercentages = {
      1: percentages[1] ?? this.defaultGradePercentages[1],
      2: percentages[2] ?? this.defaultGradePercentages[2],
      3: percentages[3] ?? this.defaultGradePercentages[3],
      4: percentages[4] ?? this.defaultGradePercentages[4],
    };

    const manualMinimums = this.normalizeNumberMap(
      response?.manualGradeMinimums ??
      response?.gradingSettings?.manualGradeMinimums ??
      {}
    );

    this.manualGradeMinimums = {
      1: manualMinimums[1] ?? this.manualGradeMinimums[1],
      2: manualMinimums[2] ?? this.manualGradeMinimums[2],
      3: manualMinimums[3] ?? this.manualGradeMinimums[3],
      4: manualMinimums[4] ?? this.manualGradeMinimums[4],
    };

    this.attachPersistedSettingsToPayload();
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

  private matchesQuery(e: ExampleDTO, query: string): boolean {
    const focusLabels = (e.focusList ?? [])
      .map(focus => focus.label ?? '')
      .join(' ');

    const haystack = this.normalize(
      [
        e.question,
        e.instruction,
        e.admin?.username ?? '',
        String(e.id),
        String(e.type ?? ''),
        focusLabels,
      ].join(' ')
    );

    return haystack.includes(query);
  }

  increaseCount(): void {
    this.printCopies = Math.min(20, (this.printCopies || 1) + 1);
  }

  decreaseCount(): void {
    this.printCopies = Math.max(1, (this.printCopies || 1) - 1);
  }
}
