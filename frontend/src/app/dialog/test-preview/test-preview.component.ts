import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPseudoCheckbox } from '@angular/material/core';

import { Example, ExampleTypes } from '../../model/Example';
import { CreateTestDTO, TestExampleDTO } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { PersistedTestSettings, TestPrintService } from '../../service/test-print.service';

@Component({
  selector: 'app-test-preview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogContent,
    MatButton,
    MatPseudoCheckbox,
  ],
  templateUrl: './test-preview.component.html',
  styleUrl: './test-preview.component.scss',
})
export class TestPreviewComponent implements OnInit {
  data = inject<{ schoolId: number; testId: number }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TestPreviewComponent>);
  private service = inject(HttpService);
  private snackBar = inject(MatSnackBar);
  private testPrintService = inject(TestPrintService);

  readonly ExampleTypes = ExampleTypes;
  readonly defaultImageWidth = 320;

  printCopies = 1;
  includeSolutionSheet = false;

  test: CreateTestDTO & PersistedTestSettings = {
    authToken: '',
    schoolId: this.data.schoolId,
    name: '',
    note: '',
    exampleList: [],
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
    },
  };

  ngOnInit(): void {
    if (!this.data.testId) return;

    this.service.getCreateTest(this.data.testId).subscribe({
      next: (response: any) => {
        this.test = {
          ...this.test,
          ...response,
        };

        this.hydratePersistedSettings(response);
        this.test.exampleList = this.hydrateConstructionImagesForEntries(this.test.exampleList ?? []);
      },
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
      getGradeRangeLabel: (grade) => this.getGradeRangeLabel(grade),
      getTaskSpacing: (exampleId) => this.getTaskSpacing(exampleId),
      getQuestionWithGapLabels: (example) => this.getQuestionWithGapLabels(example),
      getLetter: (index) => this.getLetter(index),
    });

    if (!success) {
      this.snackBar.open('Druckvorschau konnte nicht geöffnet werden.', 'OK', { duration: 3000 });
    }
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

  getTaskSpacing(exampleId: number): number {
    return Number(this.test.taskSpacingMap?.[exampleId] ?? this.test.defaultTaskSpacing ?? 48);
  }

  getTotalPoints(): number {
    return this.selectedExamples.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0);
  }

  getGradeRangeLabel(grade: number): string {
    const maxPoints = this.getTotalPoints();

    if (this.test.gradingMode === 'manual') {
      return this.getManualGradeRangeLabel(grade, maxPoints);
    }

    return this.getAutomaticGradeRangeLabel(grade, maxPoints);
  }

  getPreviewImage(example: Example): string | null {
    return (example as any).imageUrl || (example as any).image || null;
  }

  getImageWidth(example: Example): number {
    return this.normalizeImageWidth((example as any).imageWidth);
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

  private getAutomaticGradeRangeLabel(grade: number, maxPoints: number): string {
    const thresholds = this.getAutomaticThresholds(maxPoints);

    if (grade === 1) return `${thresholds[1]}–${maxPoints}`;
    if (grade === 2) return `${thresholds[2]}–${thresholds[1] - 1}`;
    if (grade === 3) return `${thresholds[3]}–${thresholds[2] - 1}`;
    if (grade === 4) return `${thresholds[4]}–${thresholds[3] - 1}`;
    return `0–${thresholds[4] - 1}`;
  }

  private getManualGradeRangeLabel(grade: number, maxPoints: number): string {
    const thresholds = this.getManualThresholds();

    if (grade === 1) return `${thresholds[1]}–${maxPoints}`;
    if (grade === 2) return `${thresholds[2]}–${thresholds[1] - 1}`;
    if (grade === 3) return `${thresholds[3]}–${thresholds[2] - 1}`;
    if (grade === 4) return `${thresholds[4]}–${thresholds[3] - 1}`;
    return `0–${thresholds[4] - 1}`;
  }

  private getAutomaticThresholds(maxPoints: number): Record<number, number> {
    const percentages = {
      1: Number(this.test.gradePercentages?.[1] ?? 90),
      2: Number(this.test.gradePercentages?.[2] ?? 78),
      3: Number(this.test.gradePercentages?.[3] ?? 65),
      4: Number(this.test.gradePercentages?.[4] ?? 50),
    };

    return {
      1: Math.ceil(maxPoints * percentages[1] / 100),
      2: Math.ceil(maxPoints * percentages[2] / 100),
      3: Math.ceil(maxPoints * percentages[3] / 100),
      4: Math.ceil(maxPoints * percentages[4] / 100),
    };
  }

  private getManualThresholds(): Record<number, number> {
    return {
      1: Number(this.test.manualGradeMinimums?.[1] ?? 18),
      2: Number(this.test.manualGradeMinimums?.[2] ?? 16),
      3: Number(this.test.manualGradeMinimums?.[3] ?? 13),
      4: Number(this.test.manualGradeMinimums?.[4] ?? 10),
    };
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
