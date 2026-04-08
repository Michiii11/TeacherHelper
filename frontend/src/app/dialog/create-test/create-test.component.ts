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
import { CreateTestDTO, GradingLevel, TestExample, TestExampleDTO } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { TestPrintService } from '../../service/test-print.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatPseudoCheckbox } from '@angular/material/core';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle'
import {TranslatePipe} from '@ngx-translate/core'

type GradeMode = 'auto' | 'manual';
type GradePresetKey = 'AT' | 'DE' | 'US' | 'MITARBEIT' | 'CUSTOM';

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
    MatButtonToggle,
    MatButtonToggleGroup,
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
    gradingSystemName: 'Österreich 1–5',
    gradingSchema: [],
    gradePercentages: {},
    manualGradeMinimums: {}
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
            this.selectedExamplesSubject.next(hydratedEntries);
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

    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }

    this.markDirty();
  }

  removeSelectedExample(entry: TestExampleDTO): void {
    const next = this.selectedExamplesSubject.value.filter((x) => x.example.id !== entry.example.id);
    this.selectedExamplesSubject.next(next);
    this.syncSelectionToTest(next);
    delete this.taskSpacingMap[entry.example.id];

    if (!this.useAutomaticGrading) {
      this.normalizeManualThresholds();
    }

    this.markDirty();
  }

  get selectedExamples(): TestExampleDTO[] {
    return this.selectedExamplesSubject.value;
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
      getGradeRangeLabel: (gradeOrIndex: number) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
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
