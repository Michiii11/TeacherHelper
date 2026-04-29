import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import {MatButton, MatIconButton} from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Example, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, GradingLevel, TestExampleDTO } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { PersistedTestSettings, TestBranding, TestPrintLabels, TestPrintService } from '../../service/test-print.service';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle'
import {MatIcon} from '@angular/material/icon'

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
  ],
  templateUrl: './test-preview.component.html',
  styleUrl: './test-preview.component.scss',
})
export class TestPreviewComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: string; testId: string }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TestPreviewComponent>);
  private service = inject(HttpService);
  private snackBar = inject(MatSnackBar);
  private testPrintService = inject(TestPrintService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);
  private readonly exampleImageObjectUrls = new Set<string>();
  private readonly exampleImageObjectUrlCache = new Map<string, string>();

  readonly ExampleTypes = ExampleTypes;
  readonly defaultImageWidth = 320;

  printCopies = 1;
  includeSolutionSheet = false;
  previewHtml: SafeHtml = '';
  labels: TestPrintLabels = this.buildPrintLabels();

  test: CreateTestDTO & PersistedTestSettings = {
    schoolId: this.data.schoolId,
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
        this.refreshPreviewHtml();
        this.loadSchoolBranding();
      },
    });
  }

  ngOnDestroy(): void {
    this.exampleImageObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.exampleImageObjectUrls.clear();
    this.exampleImageObjectUrlCache.clear();
  }

  private loadSchoolBranding(): void {
    const serviceAny = this.service as any;
    const request = serviceAny?.getSchool?.(this.data.schoolId) ?? serviceAny?.getSchoolById?.(this.data.schoolId);

    if (!request?.subscribe) {
      this.refreshPreviewHtml();
      return;
    }

    request.subscribe({
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
  }

  increaseCount(): void {
    this.printCopies = Math.min(20, (this.printCopies || 1) + 1);
  }

  decreaseCount(): void {
    this.printCopies = Math.max(1, (this.printCopies || 1) - 1);
  }

  printPreview(): void {
    const success = this.testPrintService.printTest(this.test, this.selectedExamples, {
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
      question: this.translateOrFallback('school.question', 'Question')
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

  private refreshPreviewHtml(): void {
    this.labels = this.buildPrintLabels();

    const html = this.testPrintService.buildPreviewHtml(this.test, this.selectedExamples, {
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

  getQuestionWithGapLabels(example: Example): string {
    let idx = 0;
    return (example.question || '').replace(/\{Lücke \d+\}/g, () => {
      const label = example.gaps?.[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });
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
    if (!example || example.type !== ExampleTypes.CONSTRUCTION || !example.id) {
      return example;
    }

    const hasTaskImage = !!((example as any).imageUrl || (example as any).image);
    const hasSolutionImage = !!((example as any).solutionUrl);
    const taskImageUrl = hasTaskImage
      ? await this.getAuthorizedExampleImageObjectUrl(example.id, false)
      : '';
    const solutionImageUrl = hasSolutionImage
      ? await this.getAuthorizedExampleImageObjectUrl(example.id, true)
      : '';

    return {
      ...example,
      imageUrl: taskImageUrl,
      image: taskImageUrl,
      solutionUrl: solutionImageUrl
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
