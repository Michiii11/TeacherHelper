import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Example, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, GradingLevel, TestExampleDTO, TestExampleVariableValues } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { PersistedTestSettings, TestBranding, TestPrintLabels, TestPrintService } from '../../service/test-print.service';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import {MatProgressBar} from '@angular/material/progress-bar'

@Component({
  selector: 'app-test-preview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogContent,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatIconButton,
    TranslateModule,
    MatProgressBar,
  ],
  templateUrl: './test-preview.component.html',
  styleUrl: './test-preview.component.scss',
})
export class TestPreviewComponent implements OnInit, OnDestroy {
  data = inject<{
    schoolId: string;
    testId: string;
    schoolName?: string;
    schoolLogoUrl?: string;
    schoolLogo?: string;
    collectionName?: string;
    collectionLogoUrl?: string;
    school?: { name?: string; logoUrl?: string; logo?: string } | null;
  }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TestPreviewComponent>);
  private service = inject(HttpService);
  private snackBar = inject(MatSnackBar);
  private testPrintService = inject(TestPrintService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);
  private readonly exampleImageObjectUrls = new Set<string>();
  private readonly exampleImageObjectUrlCache = new Map<string, string>();
  private schoolLogoObjectUrl = '';

  readonly ExampleTypes = ExampleTypes;
  readonly defaultImageWidth = 320;

  printCopies = 1;
  includeSolutionSheet = false;
  previewHtml: SafeHtml = '';
  labels: TestPrintLabels = this.buildPrintLabels();

  isLoading = true;

  test: CreateTestDTO & PersistedTestSettings = {
    collectionId: this.data.schoolId,
    folderId: null,
    name: '',
    note: '',
    exampleList: [],
    duration: 0,
    defaultTaskSpacing: 48,
    taskSpacingMap: {},
    gradingMode: 'auto',
    gradingSystemName: '',
    gradingSchema: [],
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
    },
  };

  ngOnInit(): void {
    if (!this.data.testId) return;

    this.service.getTest(this.data.testId).subscribe({
      next: async (response: any) => {
        this.test = {
          ...this.test,
          ...response,
        };

        this.hydratePersistedSettings(response);
        this.test.exampleList = await this.hydrateConstructionImagesForEntries(this.test.exampleList ?? []);
        await this.loadSchoolBranding();
        this.refreshPreviewHtml();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.exampleImageObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.exampleImageObjectUrls.clear();
    this.exampleImageObjectUrlCache.clear();

    if (this.schoolLogoObjectUrl) {
      URL.revokeObjectURL(this.schoolLogoObjectUrl);
      this.schoolLogoObjectUrl = '';
    }
  }

  private async loadSchoolBranding(): Promise<void> {
    const dialogData = this.data as any;
    const schoolFromDialog = dialogData?.school ?? null;
    const schoolId = String(
      (this.test as any)?.collectionId
      || (this.test as any)?.schoolId
      || dialogData?.schoolId
      || ''
    ).trim();

    (this.test as any).schoolName =
      (this.test as any).schoolName
      || schoolFromDialog?.name
      || dialogData?.schoolName
      || dialogData?.collectionName
      || '';

    (this.test as any).schoolLogoUrl =
      (this.test as any).schoolLogoUrl
      || dialogData?.schoolLogoUrl
      || dialogData?.collectionLogoUrl
      || dialogData?.schoolLogo
      || schoolFromDialog?.logoUrl
      || schoolFromDialog?.logo
      || '';

    if (schoolFromDialog) {
      (this.test as any).school = {
        ...(this.test as any).school,
        ...schoolFromDialog,
      };
    }

    if (!schoolId) return;

    try {
      const school = await firstValueFrom(this.service.getCollectionById(schoolId));

      (this.test as any).schoolName = (this.test as any).schoolName || school?.name || '';
      (this.test as any).school = {
        ...(this.test as any).school,
        ...school,
      };

      const logoUrl = await this.loadSchoolLogoObjectUrl(schoolId);
      (this.test as any).schoolLogoUrl = logoUrl || (this.test as any).schoolLogoUrl || school?.logoUrl || '';
    } catch {
      const logoUrl = await this.loadSchoolLogoObjectUrl(schoolId);
      (this.test as any).schoolLogoUrl = logoUrl || (this.test as any).schoolLogoUrl || '';
    }
  }

  private async loadSchoolLogoObjectUrl(schoolId: string): Promise<string> {
    if (this.schoolLogoObjectUrl) {
      return this.schoolLogoObjectUrl;
    }

    try {
      const blob = await firstValueFrom(this.service.getCollectionLogo(schoolId));

      if (!blob || blob.size === 0) {
        return '';
      }

      this.schoolLogoObjectUrl = URL.createObjectURL(blob);
      return this.schoolLogoObjectUrl;
    } catch {
      return '';
    }
  }

  get selectedExamples(): TestExampleDTO[] {
    return this.test.exampleList ?? [];
  }

  close(): void {
    this.dialogRef.close();
  }

  onPrintCopiesChange(value: number | string | null): void {
    const parsed = Math.round(Number(value ?? 1));
    this.printCopies = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1;
  }

  setIncludeSolutionSheet(value: boolean): void {
    this.includeSolutionSheet = value;
    this.refreshPreviewHtml();
  }

  increaseCount(): void {
    this.printCopies = Math.min(20, (this.printCopies || 1) + 1);
  }

  decreaseCount(): void {
    this.printCopies = Math.max(1, (this.printCopies || 1) - 1);
  }

  printPreview(): void {
    const success = this.testPrintService.printTest(this.test, this.buildResolvedExamplesForPreview(), {
      printCopies: this.printCopies,
      includeSolutionSheet: this.includeSolutionSheet,
      getGradeRangeLabel: (gradeOrIndex) => this.getGradeRangeLabelByIndex(gradeOrIndex - 1),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
      labels: this.labels,
      branding: this.resolveBranding(),
    });

    if (!success) {
      this.snackBar.open('Druckvorschau konnte nicht geöffnet werden.', 'OK', { duration: 3000 });
    }
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
      gradeHeader: this.translateOrFallback('createTest.preview.gradeHeader', 'Grade'),
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
      question: this.translateOrFallback('collection.question', 'Question')
    };
  }

  private resolveBranding(): TestBranding {
    const school = (this.test as any)?.school ?? null;
    const dialogData = this.data as any;

    return {
      schoolName: (this.test as any)?.schoolName || school?.name || dialogData?.schoolName || dialogData?.collectionName || '',
      schoolLogoUrl: (this.test as any)?.schoolLogoUrl || school?.logoUrl || school?.logo || dialogData?.schoolLogoUrl || dialogData?.collectionLogoUrl || dialogData?.schoolLogo || '',
      showNameWhenLogoExists: true,
    };
  }

  private isDarkModeActive(): boolean {
    return document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
  }

  private refreshPreviewHtml(): void {
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

  private buildResolvedExamplesForPreview(): TestExampleDTO[] {
    return this.selectedExamples.map(entry => ({
      ...entry,
      variableValues: {
        ...this.buildDefaultVariableValues(entry.example),
        ...((entry as any).variableValues ?? {}),
      },
      example: this.buildPreviewExample(entry),
    }));
  }

  private buildPreviewExample(entry: TestExampleDTO): Example {
    const example = this.clonePlain(entry.example) as Example;
    const variableValues = {
      ...this.buildDefaultVariableValues(entry.example),
      ...((entry as any).variableValues ?? {}),
    };

    (example as any).displaySettings = this.normalizeDisplaySettings((example as any).displaySettings);
    example.variables = this.mergeVariableValuesIntoExampleVariables(example.variables, variableValues) as any;

    return example;
  }

  private buildDefaultVariableValues(example: Example): TestExampleVariableValues {
    return Object.fromEntries(
      (example.variables ?? []).map(variable => [variable.key, variable.defaultValue ?? ''])
    );
  }

  private mergeVariableValuesIntoExampleVariables(
    variables: Example['variables'] | undefined,
    variableValues: TestExampleVariableValues | null | undefined,
  ): NonNullable<Example['variables']> {
    const values = variableValues ?? {};
    const existingVariables = Array.isArray(variables) ? variables : [];
    const normalized = existingVariables.map(variable => {
      const key = String(variable?.key ?? '').trim();
      return {
        ...variable,
        defaultValue: String(key && key in values ? values[key] ?? '' : variable?.defaultValue ?? ''),
      };
    });

    const knownKeys = new Set(normalized.map(variable => String(variable?.key ?? '').trim()).filter(Boolean));

    for (const [key, value] of Object.entries(values)) {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey || knownKeys.has(normalizedKey)) {
        continue;
      }

      normalized.push({
        id: normalizedKey,
        key: normalizedKey,
        defaultValue: String(value ?? ''),
      } as any);
    }

    return normalized as NonNullable<Example['variables']>;
  }

  private normalizeDisplaySettings(value: unknown): { showInstructionLabel: boolean; showQuestionLabel: boolean; showTaskImageLabel: boolean } {
    let settings: any = value;

    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }

    if (!settings || typeof settings !== 'object') {
      settings = {};
    }

    return {
      showInstructionLabel: settings.showInstructionLabel !== false,
      showQuestionLabel: settings.showQuestionLabel !== false,
      showTaskImageLabel: settings.showTaskImageLabel !== false,
    };
  }

  private clonePlain<T>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value ?? null));
  }

  getQuestionWithGapLabels(example: Example): string {
    let idx = 0;
    const replaceGapLabels = (text: string): string => text.replace(/\{Lücke \d+\}/g, () => {
      const label = example.gaps?.[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });

    return this.replaceOutsideLatex(example.question || '', replaceGapLabels);
  }

  private replaceOutsideLatex(value: string, replacer: (text: string) => string): string {
    const source = String(value ?? '');
    const mathPattern = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$]*?\$|\\\([\s\S]*?\\\)/g;
    let cursor = 0;
    let result = '';
    let match: RegExpExecArray | null;

    while ((match = mathPattern.exec(source)) !== null) {
      result += replacer(source.slice(cursor, match.index));
      result += match[0];
      cursor = match.index + match[0].length;
    }

    result += replacer(source.slice(cursor));
    return result;
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  getTaskSpacing(exampleId: string): number {
    return Number(this.test.taskSpacingMap?.[exampleId] ?? this.test.defaultTaskSpacing ?? 48);
  }

  get totalPoints(): number {
    return this.roundToStep(this.selectedExamples.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0), 1);
  }

  getGradeRangeLabel(grade: number): string {
    return this.getGradeRangeLabelByIndex(grade - 1);
  }

  getGradeRangeLabelByIndex(index: number): string {
    const total = this.totalPoints;
    if (total <= 0) return '–';

    const schema = this.getResolvedGradingSchema();
    if (!schema[index]) return '–';

    const min = this.getGradeMinimumByIndex(index, schema);

    if (this.test.gradingMode !== 'manual') {
      const upper = index === 0 ? Math.round(total) : this.getGradeMinimumByIndex(index - 1, schema) - 1;
      if (upper < min || upper === min) return String(min);
      return `${upper}-${min}`;
    }

    const previousMin = index === 0 ? total : this.getGradeMinimumByIndex(index - 1, schema);
    const shouldUseWholeNumbers = this.isWholeNumber(min) && this.isWholeNumber(previousMin);
    const upper = index === 0
      ? total
      : shouldUseWholeNumbers
        ? previousMin - 1
        : this.roundToStep(previousMin - 0.1, 1);

    if (upper < min || upper === min) return this.formatScore(min);
    return `${this.formatScore(upper)}-${this.formatScore(min)}`;
  }

  getPreviewImage(example: Example): string | null {
    return (example as any).imageUrl || (example as any).image || null;
  }

  getImageWidth(example: Example): number {
    return this.normalizeImageWidth((example as any).imageWidth);
  }

  private async hydrateConstructionImagesForEntries(entries: TestExampleDTO[]): Promise<TestExampleDTO[]> {
    return Promise.all((entries ?? []).map(async entry => ({
      ...entry,
      example: await this.hydrateConstructionImage(entry.example)
    })));
  }

  private async hydrateConstructionImage(example: Example): Promise<Example> {
    if (!example || !example.id || (example.type !== ExampleTypes.CONSTRUCTION && example.type !== ExampleTypes.OPEN)) {
      return example;
    }

    const [taskImageUrl, solutionImageUrl] = await Promise.all([
      example.type === ExampleTypes.CONSTRUCTION
        ? this.getAuthorizedExampleImageObjectUrl(example.id, false)
        : Promise.resolve(''),
      this.getAuthorizedExampleImageObjectUrl(example.id, true),
    ]);

    const fallbackTaskImage = (example as any).imageUrl || (example as any).image || '';
    const fallbackSolutionImage = (example as any).solutionUrl || '';

    return {
      ...example,
      imageUrl: taskImageUrl || fallbackTaskImage,
      image: taskImageUrl || fallbackTaskImage,
      solutionUrl: solutionImageUrl || fallbackSolutionImage
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

  private getResolvedGradingSchema(): GradingLevel[] {
    if (Array.isArray((this.test as any).gradingSchema) && (this.test as any).gradingSchema.length) {
      return (this.test as any).gradingSchema as GradingLevel[];
    }

    return [
      { key: '1', label: '1', shortLabel: '1', order: 0, percentageFrom: Number(this.test.gradePercentages?.[1] ?? 90), minimumPoints: Number(this.test.manualGradeMinimums?.[1] ?? 18) },
      { key: '2', label: '2', shortLabel: '2', order: 1, percentageFrom: Number(this.test.gradePercentages?.[2] ?? 78), minimumPoints: Number(this.test.manualGradeMinimums?.[2] ?? 16) },
      { key: '3', label: '3', shortLabel: '3', order: 2, percentageFrom: Number(this.test.gradePercentages?.[3] ?? 65), minimumPoints: Number(this.test.manualGradeMinimums?.[3] ?? 13) },
      { key: '4', label: '4', shortLabel: '4', order: 3, percentageFrom: Number(this.test.gradePercentages?.[4] ?? 50), minimumPoints: Number(this.test.manualGradeMinimums?.[4] ?? 10) },
      { key: '5', label: '5', shortLabel: '5', order: 4, percentageFrom: 0, minimumPoints: 0 },
    ];
  }

  private getGradeMinimumByIndex(index: number, schema = this.getResolvedGradingSchema()): number {
    if (!schema[index]) return 0;

    if (this.test.gradingMode !== 'manual') {
      const percentage = Number(schema[index].percentageFrom ?? 0);
      const value = Math.ceil(this.totalPoints * (percentage / 100));
      return Math.max(0, Math.min(this.totalPoints, value));
    }

    return Math.max(0, Math.min(this.totalPoints, this.roundToStep(Number(schema[index].minimumPoints ?? 0), 1)));
  }

  private isWholeNumber(value: number): boolean {
    return Math.abs(value - Math.round(value)) < 0.0001;
  }

  private roundToStep(value: number, decimals = 1): number {
    const factor = Math.pow(10, decimals);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  private formatScore(value: number): string {
    const rounded = this.roundToStep(value, 1);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  private normalize(value: string): string {
    return (value ?? '').toString().trim().toLowerCase();
  }

  private hydratePersistedSettings(response: any): void {
    this.test.defaultTaskSpacing = this.normalizeSpacingValue(
      response?.defaultTaskSpacing ??
      response?.layoutSettings?.defaultTaskSpacing ??
      this.test.defaultTaskSpacing
    );

    this.test.taskSpacingMap = this.normalizeNumberMap(
      response?.taskSpacingMap ??
      response?.layoutSettings?.taskSpacingMap ??
      {}
    );

    this.test.gradingMode = (response?.gradingMode ?? response?.gradingSettings?.mode ?? 'auto') === 'manual'
      ? 'manual'
      : 'auto';

    (this.test as any).gradingSystemName = response?.gradingSystemName ?? (this.test as any).gradingSystemName ?? '';

    const schema = Array.isArray(response?.gradingSchema) ? response.gradingSchema : [];
    if (schema.length) {
      (this.test as any).gradingSchema = schema.map((level: any, index: number) => ({
        key: level?.key ?? `level-${index}`,
        label: level?.label ?? `${index + 1}`,
        shortLabel: level?.shortLabel ?? String(index + 1),
        order: Number(level?.order ?? index),
        percentageFrom: Number(level?.percentageFrom ?? 0),
        minimumPoints: Number(level?.minimumPoints ?? 0),
      }));
    }

    const percentages = this.normalizeNumberMap(
      response?.gradePercentages ??
      response?.gradingSettings?.gradePercentages ??
      this.test.gradePercentages
    );

    this.test.gradePercentages = {
      1: percentages[1] ?? 90,
      2: percentages[2] ?? 78,
      3: percentages[3] ?? 65,
      4: percentages[4] ?? 50,
    };

    const manualMinimums = this.normalizeNumberMap(
      response?.manualGradeMinimums ??
      response?.gradingSettings?.manualGradeMinimums ??
      this.test.manualGradeMinimums
    );

    this.test.manualGradeMinimums = {
      1: manualMinimums[1] ?? 18,
      2: manualMinimums[2] ?? 16,
      3: manualMinimums[3] ?? 13,
      4: manualMinimums[4] ?? 10,
    };
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
}
