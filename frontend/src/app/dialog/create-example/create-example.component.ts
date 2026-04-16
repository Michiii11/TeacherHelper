import { Component, ElementRef, HostListener, ViewChild, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { MatPseudoCheckbox } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDivider } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';

import { BehaviorSubject, Subject, combineLatest, firstValueFrom, startWith } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import {
  Assign,
  CreateExampleDTO,
  ExampleTypeLabels,
  ExampleTypes,
  Focus,
  Gap,
  Option,
  ExampleVariable
} from '../../model/Example';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatProgressBar } from '@angular/material/progress-bar';

type VariableTarget =
  | { type: 'instruction' | 'question' | 'solution' }
  | { type: 'halfOpenAnswer'; index: number; answerIndex: 0 | 1 }
  | { type: 'option'; index: number }
  | { type: 'gapSolution'; index: number }
  | { type: 'gapOption'; gapIndex: number; optionIndex: number }
  | { type: 'assignLeft'; index: number }
  | { type: 'assignRight'; index: number }
  | null;

@Component({
  selector: 'app-create-example',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatTooltip,
    MatPseudoCheckbox,
    MatDivider,
    MatSliderModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatAutocompleteTrigger,
    MatAutocomplete,
    TranslateModule,
    MatProgressBar,
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: number; exampleId: number }>(MAT_DIALOG_DATA);
  private readonly destroy$ = new Subject<void>();

  private readonly http = inject(HttpService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translate = inject(TranslateService);

  hasUnsavedChanges = false;
  isEditMode = false;
  isSaving = false;

  selectedConstructionImageFile: File | null = null;
  selectedConstructionSolutionFile: File | null = null;

  constructionImagePreviewUrl: string | null = null;
  constructionSolutionPreviewUrl: string | null = null;

  readonly maxImageBytes = 5 * 1024 * 1024;
  readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  readonly defaultImageWidth = 320;

  isDraggingConstructionPreview = false;
  isDraggingConstructionSolution = false;

  activeVariableTarget: VariableTarget = null;

  example: CreateExampleDTO = {
    authToken: '',
    schoolId: this.data.schoolId,
    type: ExampleTypes.OPEN,
    instruction: '',
    question: '',
    answers: [['', '']] as string[][],
    options: [{ id: this.generateUniqueId(), text: '', correct: false }] as Option[],
    gapFillType: 'SELECT',
    gaps: [],
    assigns: [{ left: '', right: '' }] as Assign[],
    assignRightItems: [''],
    image: '',
    solution: '',
    solutionUrl: '',
    focusList: [],
    variables: [],
    imageWidth: this.defaultImageWidth,
    solutionImageWidth: this.defaultImageWidth
  };

  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes) as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;

  private readonly variablePattern = /\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.dialogRef.disableClose = true;

    this.dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeDialog());

    this.dialogRef.keydownEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.key === 'Escape') this.closeDialog();
      });
  }

  private readonly focusSubject = new BehaviorSubject<Focus[]>([]);
  readonly focus$ = this.focusSubject.asObservable();

  private readonly selectedFocusSubject = new BehaviorSubject<Focus[]>([]);
  readonly selectedFocus$ = this.selectedFocusSubject.asObservable();

  inputCtrl = new FormControl<string>('');

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger!: MatAutocompleteTrigger;

  readonly filteredFocusList = combineLatest([
    this.inputCtrl.valueChanges.pipe(startWith('')),
    this.focus$,
    this.selectedFocus$,
  ]).pipe(
    map(([rawValue, focuses, selected]) => {
      const query = this.normalizeLabel(typeof rawValue === 'string' ? rawValue : '');
      const selectedSet = new Set(selected.map(s => this.normalizeLabel(s.label)));

      return focuses
        .filter(f => !selectedSet.has(this.normalizeLabel(f.label)))
        .filter(f => !query || this.normalizeLabel(f.label).includes(query));
    })
  );

  ngOnInit(): void {
    this.http.getAllFocus(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(focuses => this.focusSubject.next(focuses));

    if (this.data.exampleId) {
      this.http.getCreateExample(this.data.exampleId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.example = {
              ...response,
              imageWidth: response.imageWidth ?? this.defaultImageWidth,
              solutionImageWidth: response.solutionImageWidth ?? this.defaultImageWidth,
              variables: response.variables ?? []
            };
            this.isEditMode = true;

            if (this.example.type === ExampleTypes.CONSTRUCTION && this.data.exampleId) {
              this.constructionImagePreviewUrl = this.example.image
                ? this.http.getConstructionImageUrl(this.data.exampleId)
                : null;
              this.constructionSolutionPreviewUrl = this.example.solutionUrl
                ? this.http.getConstructionSolutionImageUrl(this.data.exampleId)
                : null;

              this.example.image = this.constructionImagePreviewUrl ?? '';
              this.example.solutionUrl = this.constructionSolutionPreviewUrl ?? '';
            }

            this.normalizeLoadedGapState();
            this.syncVariablesFromContent();
            this.emitSelectedFocus();
          }
        });
    } else {
      this.normalizeLoadedGapState();
      this.syncVariablesFromContent();
      this.emitSelectedFocus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  generateUniqueId(): string {
    return Math.random().toString(36).slice(2, 11);
  }

  private normalizeLabel(label: string): string {
    return (label ?? '').trim().toLowerCase();
  }

  private emitSelectedFocus(): void {
    this.selectedFocusSubject.next([...(this.example.focusList ?? [])]);
  }

  private clearFocusInput(): void {
    this.inputCtrl.setValue('');
    if (this.inputEl) this.inputEl.nativeElement.value = '';
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
  }

  setVariableTarget(target: VariableTarget): void {
    this.activeVariableTarget = target;
  }

  private normalizeVariableKey(key: string | null | undefined): string {
    return (key ?? '').trim();
  }

  private getVariableSourceTexts(): string[] {
    const parts: string[] = [
      this.example.instruction ?? '',
      this.example.question ?? '',
      this.example.solution ?? '',
      ...(this.example.answers ?? []).flatMap(answer => [answer?.[0] ?? '', answer?.[1] ?? '']),
      ...(this.example.options ?? []).map(option => option?.text ?? ''),
      ...(this.example.gaps ?? []).flatMap(gap => [
        gap?.label ?? '',
        gap?.solution ?? '',
        ...((gap?.options ?? []).map(option => option?.text ?? '')),
      ]),
      ...(this.example.assigns ?? []).flatMap(assign => [assign?.left ?? '', assign?.right ?? '']),
      ...(this.example.assignRightItems ?? []),
    ];

    return parts.filter(Boolean);
  }

  syncVariablesFromContent(): void {
    const previousMap = new Map(
      (this.example.variables ?? []).map(variable => [this.normalizeVariableKey(variable.key), variable])
    );

    const keysInOrder: string[] = [];

    for (const sourceText of this.getVariableSourceTexts()) {
      for (const match of sourceText.matchAll(this.variablePattern)) {
        const normalizedKey = this.normalizeVariableKey(match[1]);
        if (!normalizedKey || keysInOrder.includes(normalizedKey)) {
          continue;
        }
        keysInOrder.push(normalizedKey);
      }
    }

    this.example.variables = keysInOrder.map(key => {
      const existing = previousMap.get(key);
      return {
        id: existing?.id || this.generateUniqueId(),
        key,
        defaultValue: existing?.defaultValue ?? ''
      } as ExampleVariable;
    });
  }

  trackByVariableKey(index: number, variable: ExampleVariable): string {
    return variable.key || String(index);
  }

  private getNextVariablePlaceholder(): string {
    const usedKeys = new Set((this.example.variables ?? []).map(variable => variable.key));
    let nextIndex = Math.max(1, (this.example.variables?.length ?? 0) + 1);
    let nextKey = `wert${nextIndex}`;

    while (usedKeys.has(nextKey)) {
      nextIndex += 1;
      nextKey = `wert${nextIndex}`;
    }

    return `{${nextKey}}`;
  }

  private appendInsertText(value: string | null | undefined, insertText: string): string {
    return `${value ?? ''}${insertText}`;
  }

  insertVariableAtCursor(): void {
    const variableText = this.getNextVariablePlaceholder();
    const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const canUseCursor = !!activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT');

    if (canUseCursor) {
      const start = activeElement.selectionStart ?? 0;
      const end = activeElement.selectionEnd ?? start;
      const value = activeElement.value ?? '';

      activeElement.value = value.slice(0, start) + variableText + value.slice(end);
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));

      const nextCursor = start + variableText.length;
      requestAnimationFrame(() => {
        activeElement.focus();
        activeElement.setSelectionRange(nextCursor, nextCursor);
      });

      this.syncVariablesFromContent();
      this.markDirty();
      return;
    }

    switch (this.activeVariableTarget?.type) {
      case 'instruction':
        this.example.instruction = this.appendInsertText(this.example.instruction, variableText);
        break;
      case 'question':
        this.example.question = this.appendInsertText(this.example.question, variableText);
        break;
      case 'solution':
        this.example.solution = this.appendInsertText(this.example.solution, variableText);
        break;
      case 'halfOpenAnswer': {
        const row = this.example.answers?.[this.activeVariableTarget.index];
        if (row) {
          row[this.activeVariableTarget.answerIndex] = this.appendInsertText(
            row[this.activeVariableTarget.answerIndex],
            variableText
          );
        }
        break;
      }
      case 'option': {
        const option = this.example.options?.[this.activeVariableTarget.index];
        if (option) {
          option.text = this.appendInsertText(option.text, variableText);
        }
        break;
      }
      case 'gapSolution': {
        const gap = this.example.gaps?.[this.activeVariableTarget.index];
        if (gap) {
          gap.solution = this.appendInsertText(gap.solution, variableText);
        }
        break;
      }
      case 'gapOption': {
        const option = this.example.gaps?.[this.activeVariableTarget.gapIndex]?.options?.[this.activeVariableTarget.optionIndex];
        if (option) {
          option.text = this.appendInsertText(option.text, variableText);
        }
        break;
      }
      case 'assignLeft': {
        const assign = this.example.assigns?.[this.activeVariableTarget.index];
        if (assign) {
          assign.left = this.appendInsertText(assign.left, variableText);
        }
        break;
      }
      case 'assignRight': {
        const right = this.example.assignRightItems?.[this.activeVariableTarget.index];
        if (right != null) {
          this.example.assignRightItems[this.activeVariableTarget.index] = this.appendInsertText(right, variableText);
        }
        break;
      }
      default:
        this.example.question = this.appendInsertText(this.example.question, variableText);
        break;
    }

    this.syncVariablesFromContent();
    this.markDirty();
  }

  removeVariable(variable: ExampleVariable): void {
    const key = this.normalizeVariableKey(variable?.key);
    if (!key) return;

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\{${escapedKey}\\}`, 'g');

    const replaceValue = (value: string | null | undefined): string =>
      (value ?? '').replace(pattern, '');

    this.example.instruction = replaceValue(this.example.instruction);
    this.example.question = replaceValue(this.example.question);
    this.example.solution = replaceValue(this.example.solution);

    this.example.answers = (this.example.answers ?? []).map(answer => [
      replaceValue(answer?.[0]),
      replaceValue(answer?.[1]),
    ]);

    this.example.options = (this.example.options ?? []).map(option => ({
      ...option,
      text: replaceValue(option?.text),
    }));

    this.example.gaps = (this.example.gaps ?? []).map(gap => ({
      ...gap,
      label: replaceValue(gap?.label),
      solution: replaceValue(gap?.solution),
      options: (gap?.options ?? []).map(option => ({
        ...option,
        text: replaceValue(option?.text),
      })),
    }));

    this.example.assigns = (this.example.assigns ?? []).map(assign => ({
      ...assign,
      left: replaceValue(assign?.left),
      right: replaceValue(assign?.right),
    }));

    this.example.assignRightItems = (this.example.assignRightItems ?? []).map(item => replaceValue(item));
    this.example.variables = (this.example.variables ?? []).filter(entry => this.normalizeVariableKey(entry.key) !== key);
    this.activeVariableTarget = null;

    this.syncVariablesFromContent();
    this.markDirty();
  }

  getResolvedTextWithDefaults(value: string | null | undefined): string {
    return (value ?? '').replace(this.variablePattern, (_match, key: string) => {
      const variable = (this.example.variables ?? []).find(entry => entry.key === key.trim());
      return variable?.defaultValue ?? '';
    });
  }

  addOption(): void {
    this.example.options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeOption(i: number): void {
    if (this.example.options.length <= 0) return;
    this.example.options.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addHalfOpenAnswer(): void {
    this.example.answers.push(['', '']);
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number): void {
    if (this.example.answers.length <= 0) return;
    this.example.answers.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addAssignLeftItem(): void {
    this.example.assigns.push({ left: '', right: '' });
    this.markDirty();
  }

  removeAssignLeftItem(i: number): void {
    this.example.assigns.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addAssignRightItem(): void {
    this.example.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number): void {
    this.example.assignRightItems.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  setAssignConnection(assign: Assign, rightValue: string | null): void {
    assign.right = rightValue || '';
    this.syncVariablesFromContent();
    this.markDirty();
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  updateGapsFromText(): void {
    const regex = /\{(\d+)\}/g;
    const matches = Array.from(this.example.question.matchAll(regex));

    const oldGaps = [...this.example.gaps];
    const newGaps: Gap[] = [];

    matches.forEach(match => {
      const gapIndex = Number(match[1]) - 1;
      const existing = oldGaps[gapIndex] as (Gap & { width?: number }) | undefined;

      if (existing) {
        newGaps.push({
          ...existing,
          width: this.normalizeGapWidth(existing.width, existing.solution)
        } as Gap);
      } else {
        newGaps.push({
          id: this.generateUniqueId(),
          label: '',
          solution: '',
          width: this.getDefaultGapWidth(''),
          options: this.example.gapFillType === 'SELECT'
            ? [{ id: this.generateUniqueId(), text: '', correct: false }]
            : []
        } as Gap);
      }
    });

    this.example.gaps = newGaps;
  }

  insertGapAtCursor(): void {
    const textarea = document.querySelector('textarea[name="question"]') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const value = textarea.value ?? '';

    const nextIdx = (value.match(/\{(\d+)\}/g)?.length ?? 0) + 1;
    const gapText = `{${nextIdx}}`;

    textarea.value = value.slice(0, start) + gapText + value.slice(end);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    this.markDirty();
    this.updateGapsFromText();
  }

  onGapFillTypeChange(type: 'SELECT' | 'INPUT'): void {
    this.example.gapFillType = type;
    this.syncVariablesFromContent();
    this.updateGapsFromText();

    if (type === 'INPUT') {
      this.example.gaps.forEach(gap => this.ensureGapWidth(gap));
    }

    this.markDirty();
  }

  private escapeHtml(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }

  getQuestionPreviewHtml(): SafeHtml {
    const escapedQuestion = this.escapeHtml(this.getResolvedTextWithDefaults(this.example.question || ''));
    let idx = 0;

    const html = escapedQuestion.replace(/\{\d+\}/g, () => {
      const gap = this.example.gaps[idx];
      const gapNumber = this.escapeHtml(this.getGapNumber(idx));
      const width = gap ? this.getGapWidth(gap) : this.getDefaultGapWidth('');
      idx++;

      if (this.example.gapFillType === 'INPUT') {
        return `
          <span class="gap-inline gap-inline-input" style="width:${width}px;">
            <span class="gap-inline-label gap-inline-label-number">${gapNumber}</span>
            <span class="gap-inline-line"></span>
          </span>
        `;
      }

      return `
        <span class="gap-inline gap-inline-select">
          <span class="gap-inline-pill">
            <span class="gap-inline-pill-number">${gapNumber}</span>
          </span>
        </span>
      `;
    });

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getGapNumber(index: number): string {
    return String(index + 1);
  }

  private getGapWidthValue(gap: Gap): number | undefined {
    const width = Number((gap as Gap & { width?: number }).width);
    return Number.isFinite(width) ? width : undefined;
  }

  private setGapWidthValue(gap: Gap, width: number): void {
    (gap as Gap & { width?: number }).width = width;
  }

  private getDefaultGapWidth(solution: string | null | undefined): number {
    const solutionLength = (solution ?? '').trim().length;
    const estimated = 90 + solutionLength * 9;
    return Math.max(90, Math.min(420, estimated));
  }

  private normalizeGapWidth(value: number | null | undefined, solution: string | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.getDefaultGapWidth(solution);
    }

    return Math.max(90, Math.min(420, Math.round(parsed)));
  }

  ensureGapWidth(gap: Gap): void {
    this.setGapWidthValue(gap, this.normalizeGapWidth(this.getGapWidthValue(gap), gap.solution));
  }

  getGapWidth(gap: Gap): number {
    const normalized = this.normalizeGapWidth(this.getGapWidthValue(gap), gap.solution);

    if (this.getGapWidthValue(gap) !== normalized) {
      this.setGapWidthValue(gap, normalized);
    }

    return normalized;
  }

  setGapWidth(gap: Gap, value: number | string | null): void {
    const normalized = this.normalizeGapWidth(value as number | null | undefined, gap.solution);
    this.setGapWidthValue(gap, normalized);
    this.markDirty();
  }

  onGapSolutionChange(gap: Gap): void {
    const currentWidth = this.getGapWidthValue(gap);
    const normalizedCurrentWidth = this.normalizeGapWidth(currentWidth, '');
    const autoWidth = this.getDefaultGapWidth(gap.solution);

    if (currentWidth === undefined || normalizedCurrentWidth === this.getDefaultGapWidth('')) {
      this.setGapWidthValue(gap, autoWidth);
    } else {
      this.setGapWidthValue(gap, this.normalizeGapWidth(currentWidth, gap.solution));
    }

    this.syncVariablesFromContent();
    this.markDirty();
  }

  private normalizeLoadedGapState(): void {
    this.example.gaps = (this.example.gaps ?? []).map(gap => {
      const normalizedGap = { ...gap } as Gap;

      if (this.example.gapFillType === 'INPUT') {
        this.setGapWidthValue(normalizedGap, this.normalizeGapWidth(this.getGapWidthValue(normalizedGap), normalizedGap.solution));
      }

      return normalizedGap;
    });
  }

  setDragState(type: 'preview' | 'solution', active: boolean): void {
    if (type === 'preview') {
      this.isDraggingConstructionPreview = active;
      return;
    }

    this.isDraggingConstructionSolution = active;
  }

  onFileDrop(event: DragEvent, type: 'preview' | 'solution'): void {
    event.preventDefault();
    event.stopPropagation();
    this.setDragState(type, false);

    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const input = { files: event.dataTransfer?.files ?? null, value: '' } as HTMLInputElement;
    this.onImageSelected({ target: input } as unknown as Event, type);
  }

  addGapOption(gi: number): void {
    this.example.gaps[gi].options = this.example.gaps[gi].options || [];
    this.example.gaps[gi].options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number): void {
    this.example.gaps[gi].options.splice(oi, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  async onImageSelected(event: Event, type: 'solution' | 'preview'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;

    if (!this.allowedImageTypes.includes(file.type)) {
      this.snackBar.open('Bitte nur JPG, PNG oder WEBP hochladen.', 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    const compressed = await this.compressImage(file, 512, 0.72);

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'solution') {
        this.selectedConstructionSolutionFile = compressed;
        this.constructionSolutionPreviewUrl = reader.result as string;
      } else {
        this.selectedConstructionImageFile = compressed;
        this.constructionImagePreviewUrl = reader.result as string;
      }
      this.markDirty();
    };

    reader.readAsDataURL(compressed);
  }

  async removeSelectedImage(type: 'solution' | 'preview'): Promise<void> {
    if (type === 'solution') {
      if (this.selectedConstructionSolutionFile) {
        this.selectedConstructionSolutionFile = null;
        this.constructionSolutionPreviewUrl = this.isEditMode && this.data.exampleId && this.example.solutionUrl
          ? this.http.getConstructionSolutionImageUrl(this.data.exampleId)
          : null;
        this.markDirty();
        return;
      }

      if (this.isEditMode && this.data.exampleId && this.constructionSolutionPreviewUrl) {
        try {
          await firstValueFrom(this.http.deleteConstructionSolutionImage(this.data.exampleId));
          this.constructionSolutionPreviewUrl = null;
          this.example.solutionUrl = '';
          this.example.solutionImageWidth = this.defaultImageWidth;
          this.markDirty();
          this.snackBar.open('Lösungsbild gelöscht.', 'OK', { duration: 2500 });
          return;
        } catch {
          this.snackBar.open('Lösungsbild konnte nicht gelöscht werden.', 'OK', { duration: 3000 });
          return;
        }
      }

      this.constructionSolutionPreviewUrl = null;
      this.example.solutionUrl = '';
      this.example.solutionImageWidth = this.defaultImageWidth;
      this.markDirty();
      return;
    }

    if (this.selectedConstructionImageFile) {
      this.selectedConstructionImageFile = null;
      this.constructionImagePreviewUrl = this.isEditMode && this.data.exampleId && this.example.image
        ? this.http.getConstructionImageUrl(this.data.exampleId)
        : null;
      this.markDirty();
      return;
    }

    if (this.isEditMode && this.data.exampleId && this.constructionImagePreviewUrl) {
      try {
        await firstValueFrom(this.http.deleteConstructionImage(this.data.exampleId));
        this.constructionImagePreviewUrl = null;
        this.example.image = '';
        this.example.imageWidth = this.defaultImageWidth;
        this.markDirty();
        this.snackBar.open('Aufgabenbild gelöscht.', 'OK', { duration: 2500 });
        return;
      } catch {
        this.snackBar.open('Aufgabenbild konnte nicht gelöscht werden.', 'OK', { duration: 3000 });
        return;
      }
    }

    this.constructionImagePreviewUrl = null;
    this.example.image = '';
    this.example.imageWidth = this.defaultImageWidth;
    this.markDirty();
  }

  private buildExamplePayload(): CreateExampleDTO {
    return {
      ...this.example,
      authToken: localStorage.getItem('teacher_authToken') || '',
      schoolId: Number(this.example.schoolId || this.data.schoolId),
      image: this.isEditMode ? (this.example.image || '') : '',
      solutionUrl: this.isEditMode ? (this.example.solutionUrl || '') : '',
      variables: (this.example.variables ?? []).map(variable => ({
        id: variable.id || this.generateUniqueId(),
        key: this.normalizeVariableKey(variable.key),
        defaultValue: variable.defaultValue ?? ''
      })).filter(variable => !!variable.key),
      imageWidth: this.normalizeImageWidth(this.example.imageWidth),
      solutionImageWidth: this.normalizeImageWidth(this.example.solutionImageWidth)
    };
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }

  private async uploadConstructionAssets(exampleId: number): Promise<void> {
    if (this.selectedConstructionImageFile) {
      await firstValueFrom(this.http.uploadConstructionImage(exampleId, this.selectedConstructionImageFile));
    }

    if (this.selectedConstructionSolutionFile) {
      await firstValueFrom(this.http.uploadConstructionSolutionImage(exampleId, this.selectedConstructionSolutionFile));
    }

    this.constructionImagePreviewUrl = this.example.image || this.selectedConstructionImageFile
      ? this.http.getConstructionImageUrl(exampleId)
      : null;
    this.constructionSolutionPreviewUrl = this.example.solutionUrl || this.selectedConstructionSolutionFile
      ? this.http.getConstructionSolutionImageUrl(exampleId)
      : null;

    this.example.image = this.constructionImagePreviewUrl ?? '';
    this.example.solutionUrl = this.constructionSolutionPreviewUrl ?? '';
    this.selectedConstructionImageFile = null;
    this.selectedConstructionSolutionFile = null;
  }

  async saveExample(): Promise<void> {
    this.syncVariablesFromContent();

    if (!this.example.instruction.trim() || !this.example.question.trim()) {
      this.snackBar.open('Bitte füllen Sie sowohl die Angabe als auch die Aufgabenstellung aus.', 'OK', {
        duration: 3000
      });
      return;
    }

    if (this.isSaving) {
      return;
    }

    if (this.example.type === ExampleTypes.CONSTRUCTION && !this.isEditMode && !this.selectedConstructionImageFile) {
      this.snackBar.open('Bitte zuerst ein Aufgabenbild auswählen.', 'OK', { duration: 3000 });
      return;
    }

    this.isSaving = true;

    try {
      const payload = this.buildExamplePayload();

      if (this.isEditMode) {
        const updatedIdRaw = await firstValueFrom(this.http.saveExample(this.data.exampleId, payload));
        const updatedId = Number(updatedIdRaw) || this.data.exampleId;

        if (this.example.type === ExampleTypes.CONSTRUCTION) {
          await this.uploadConstructionAssets(updatedId);
        }

        this.snackBar.open('Beispiel erfolgreich gespeichert', 'OK', { duration: 3000 });
      } else {
        const createdIdRaw = await firstValueFrom(this.http.createExample(payload));
        const createdId = Number(createdIdRaw);

        if (!createdId) {
          throw new Error('Example-ID fehlt nach dem Erstellen.');
        }

        if (this.example.type === ExampleTypes.CONSTRUCTION) {
          await this.uploadConstructionAssets(createdId);
        }

        this.snackBar.open('Beispiel erfolgreich erstellt', 'OK', { duration: 3000 });
      }

      this.hasUnsavedChanges = false;
      this.dialogRef.close(true);
    } catch (error) {
      console.error(error);
      this.snackBar.open('Beispiel konnte nicht gespeichert werden.', 'OK', { duration: 3500 });
    } finally {
      this.isSaving = false;
    }
  }

  async closeDialog(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Dialog schließen?',
          message: 'Nicht gespeicherte Änderungen gehen verloren. Möchten Sie den Dialog wirklich schließen?',
          cancelText: 'Weiter bearbeiten',
          confirmText: 'Schließen'
        }
      });

      const confirmed = await firstValueFrom(confirmRef.afterClosed());
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

  trackByIndex(index: number): number {
    return index;
  }

  trackByOptionId(index: number, option: Option): string {
    return option.id;
  }

  trackByGapId(index: number, gap: Gap): string {
    return gap.id;
  }

  getQuestionWithGapLabels(): string {
    let idx = 0;
    return this.getResolvedTextWithDefaults(this.example.question).replace(/\{\d+\}/g, () => {
      idx++;
      return `[${idx}]`;
    });
  }

  getResolvedHalfOpenPrompt(answerRow: string[] | null | undefined): string {
    return this.getResolvedTextWithDefaults(answerRow?.[0] ?? '');
  }

  getResolvedMultipleChoiceOption(option: Option): string {
    return this.getResolvedTextWithDefaults(option?.text ?? '');
  }

  getResolvedGapOption(option: Option): string {
    return this.getResolvedTextWithDefaults(option?.text ?? '');
  }

  getResolvedAssignLeft(assign: Assign): string {
    return this.getResolvedTextWithDefaults(assign?.left ?? '');
  }

  getResolvedAssignRight(value: string | null | undefined): string {
    return this.getResolvedTextWithDefaults(value ?? '');
  }

  getTooltip(t: ExampleTypes): string {
    switch (t) {
      case ExampleTypes.OPEN:
        return 'Antwort ohne Vorgaben.';
      case ExampleTypes.HALF_OPEN:
        return 'Antwort in vorgegebene Struktur eintragen.';
      case ExampleTypes.CONSTRUCTION:
        return 'Aufgabe mit Bild oder Grafik.';
      case ExampleTypes.MULTIPLE_CHOICE:
        return 'Eine oder mehrere Optionen auswählen.';
      case ExampleTypes.GAP_FILL:
        return 'Lücken durch Auswahl oder Eingabe füllen.';
      case ExampleTypes.ASSIGN:
        return 'Elemente einander zuordnen.';
      default:
        return '';
    }
  }

  showCreateOption(value: string | Focus | null): boolean {
    if (!value) return false;

    const label = this.normalizeLabel(typeof value === 'string' ? value : value.label);
    if (!label) return false;

    const existsInCatalog = this.focusSubject.value.some(f => this.normalizeLabel(f.label) === label);
    const alreadySelected = this.example.focusList.some(f => this.normalizeLabel(f.label) === label);

    return !existsInCatalog && !alreadySelected;
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    const opt = event.option.value as Focus | string;

    const value: Focus =
      typeof opt === 'string'
        ? { id: 0, label: opt }
        : { id: opt.id, label: opt.label };

    this.addFocus(value);
    this.autocompleteTrigger.closePanel();
  }

  addFromInput(event: MatChipInputEvent): void {
    if (this.autocompleteTrigger?.panelOpen) return;

    const raw = (event.value ?? '').toString();
    const label = raw.trim();
    if (!label) return;

    this.addFocus({ id: 0, label });
    event.chipInput?.clear();
  }

  remove(focus: Focus): void {
    const removeLabel = this.normalizeLabel(focus.label);
    this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removeLabel);

    this.emitSelectedFocus();
    this.markDirty();
  }

  private addFocus(value: Focus): void {
    const label = this.normalizeLabel(value.label);
    if (!label) {
      this.clearFocusInput();
      return;
    }

    if (this.example.focusList.some(f => this.normalizeLabel(f.label) === label)) {
      this.clearFocusInput();
      return;
    }

    const existing = this.focusSubject.value.find(f => this.normalizeLabel(f.label) === label);
    const focusToAdd: Focus = existing ? existing : { id: 0, label: value.label.trim() };

    this.example.focusList.push(focusToAdd);

    this.emitSelectedFocus();
    this.markDirty();

    if (!existing) {
      const optimistic: Focus = { id: 0, label: focusToAdd.label };
      this.focusSubject.next([...this.focusSubject.value, optimistic]);

      this.http.createFocus(this.data.schoolId, { id: -1, label: focusToAdd.label })
        .pipe(takeUntil(this.destroy$))
        .subscribe(createdFocus => {
          const selIdx = this.example.focusList.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (selIdx !== -1) {
            this.example.focusList[selIdx] = createdFocus;
            this.emitSelectedFocus();
          }

          const catalog = [...this.focusSubject.value];
          const catIdx = catalog.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (catIdx !== -1) {
            catalog[catIdx] = createdFocus;
            this.focusSubject.next(catalog);
          }
        });
    }

    this.clearFocusInput();
  }

  deleteFocus(focus: Focus, event: MouseEvent): void {
    event.stopPropagation();

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Schwerpunkt löschen?',
        message: 'Möchten Sie diesen Schwerpunkt wirklich löschen? Er kann auch in anderen Beispielen verwendet werden.',
        cancelText: 'Abbrechen',
        confirmText: 'Löschen',
        requireConfirmation: true,
        confirmationText: 'Ich verstehe, dass diese Aktion nicht rückgängig gemacht werden kann.'
      },
    }).afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (!result) return;

        this.http.deleteFocus(this.data.schoolId, focus.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.snackBar.open(`Der Schwerpunkt "${focus.label}" wurde gelöscht.`, 'OK', { duration: 3000 });
          });

        this.focusSubject.next(this.focusSubject.value.filter(f => f.id !== focus.id));

        const removedLabel = this.normalizeLabel(focus.label);
        this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removedLabel);

        this.emitSelectedFocus();
        this.markDirty();
      });
  }

  onTypeChange(type: ExampleTypes): void {
    this.example.type = type;
    this.syncVariablesFromContent();

    if (type === ExampleTypes.GAP_FILL) {
      this.updateGapsFromText();
      if (this.example.gapFillType === 'INPUT') {
        this.example.gaps.forEach(gap => this.ensureGapWidth(gap));
      }
    }

    this.markDirty();
  }

  private async compressImage(file: File, maxSize = 512, quality = 0.72): Promise<File> {
    const img = new Image();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      img.onerror = () => reject(new Error('Bild konnte nicht verarbeitet werden.'));

      reader.onload = () => {
        img.src = reader.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');

        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas-Kontext konnte nicht erstellt werden.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Bild konnte nicht komprimiert werden.'));
              return;
            }

            resolve(new File(
              [blob],
              file.name.replace(/\.\w+$/, '.jpg'),
              { type: 'image/jpeg' }
            ));
          },
          'image/jpeg',
          quality
        );
      };

      reader.readAsDataURL(file);
    });
  }
}
