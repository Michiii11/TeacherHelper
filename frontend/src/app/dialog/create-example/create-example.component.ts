import { Component, ElementRef, HostListener, ViewChild, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
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
  Option
} from '../../model/Example';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

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
    MatDialogContent,
    MatTooltip,
    MatPseudoCheckbox,
    MatDivider,
    MatSliderModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatAutocompleteTrigger,
    MatAutocomplete,
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: number; exampleId: number }>(MAT_DIALOG_DATA);
  private readonly destroy$ = new Subject<void>();

  private readonly http = inject(HttpService);

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
    imageWidth: this.defaultImageWidth,
    solutionImageWidth: this.defaultImageWidth
  };

  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes) as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    dialogRef.disableClose = true;

    dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeDialog());

    dialogRef.keydownEvents()
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
              solutionImageWidth: response.solutionImageWidth ?? this.defaultImageWidth
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

            this.emitSelectedFocus();
          }
        });
    } else {
      this.emitSelectedFocus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
  }

  addOption(): void {
    this.example.options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeOption(i: number): void {
    if (this.example.options.length <= 0) return;
    this.example.options.splice(i, 1);
    this.markDirty();
  }

  addHalfOpenAnswer(): void {
    this.example.answers.push(['', '']);
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number): void {
    if (this.example.answers.length <= 0) return;
    this.example.answers.splice(i, 1);
    this.markDirty();
  }

  addAssignLeftItem(): void {
    this.example.assigns.push({ left: '', right: '' });
    this.markDirty();
  }

  removeAssignLeftItem(i: number): void {
    this.example.assigns.splice(i, 1);
    this.markDirty();
  }

  addAssignRightItem(): void {
    this.example.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number): void {
    this.example.assignRightItems.splice(i, 1);
    this.markDirty();
  }

  setAssignConnection(assign: Assign, rightValue: string | null): void {
    assign.right = rightValue || '';
    this.markDirty();
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  updateGapsFromText(): void {
    const regex = /\{Lücke (\d+)\}/g;
    const matches = Array.from(this.example.question.matchAll(regex));

    const oldGaps = [...this.example.gaps];
    const newGaps: Gap[] = [];

    matches.forEach(match => {
      const gapIndex = Number(match[1]) - 1;
      const existing = oldGaps[gapIndex];

      if (existing) {
        newGaps.push(existing);
      } else {
        newGaps.push({
          id: '',
          label: '',
          solution: '',
          options: this.example.gapFillType === 'SELECT'
            ? [{ id: this.generateUniqueId(), text: '', correct: false }]
            : []
        });
      }
    });

    this.example.gaps = newGaps;
  }

  insertGapAtCursor(): void {
    const textarea = document.querySelector('textarea[name="question"]') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const nextIdx = (value.match(/\{Lücke (\d+)\}/g)?.length ?? 0) + 1;
    const gapText = `{Lücke ${nextIdx}}`;

    textarea.value = value.slice(0, start) + gapText + value.slice(end);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    this.markDirty();
    this.updateGapsFromText();
  }

  onGapFillTypeChange(type: 'SELECT' | 'INPUT'): void {
    this.example.gapFillType = type;
    this.updateGapsFromText();
    this.markDirty();
  }

  addGapOption(gi: number): void {
    this.example.gaps[gi].options = this.example.gaps[gi].options || [];
    this.example.gaps[gi].options.push({ text: '', correct: false } as Option);
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number): void {
    this.example.gaps[gi].options.splice(oi, 1);
    this.markDirty();
  }

  onImageSelected(event: Event, type: 'solution' | 'preview'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.allowedImageTypes.includes(file.type)) {
      this.snackBar.open('Bitte nur JPG, PNG oder WEBP hochladen.', 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxImageBytes) {
      this.snackBar.open('Das Bild darf maximal 5 MB groß sein.', 'OK', { duration: 3200 });
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'solution') {
        this.selectedConstructionSolutionFile = file;
        this.constructionSolutionPreviewUrl = reader.result as string;
      } else {
        this.selectedConstructionImageFile = file;
        this.constructionImagePreviewUrl = reader.result as string;
      }
      this.markDirty();
    };
    reader.readAsDataURL(file);
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
    if (!this.example.instruction.trim() || !this.example.question.trim()) {
      this.snackBar.open('Bitte füllen Sie sowohl die Aufgabenstellung als auch die Angabe aus.', 'OK', {
        duration: 3000
      });
      return;
    }

    if (this.isSaving) {
      return;
    }

    if (this.example.type === ExampleTypes.CONSTRUCTION && !this.isEditMode && !this.selectedConstructionImageFile) {
      this.snackBar.open('Bitte ein Aufgabenbild auswählen.', 'OK', { duration: 3000 });
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
          title: 'Warnung',
          message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.',
          cancelText: 'Abbrechen',
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
    return this.example.question.replace(/\{Lücke \d+\}/g, () => {
      const label = this.example.gaps[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });
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
        title: 'Warnung',
        message: 'Möchten Sie diesen Schwerpunkt wirklich löschen? Es kann sein das er noch bei anderen Beispielen verwenden wird.',
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

  onTypeChange(type: ExampleTypes) {
    this.example.type = type;
    this.markDirty();
  }
}
